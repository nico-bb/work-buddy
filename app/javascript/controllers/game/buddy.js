import { AnimatedSprite, Container } from "pixi.js";
import { getSpritesheetAnimation } from "./assets";
import { Vector2, Vector3 } from "./math";
import { SignalDispatcher } from "./signal";
import { secondToTick } from "./utils";

export class Buddy extends Container {
  grid;
  sprite;
  currentCoord;
  timer = 0;
  rate = secondToTick(3);
  agent = new BehaviorTree();
  offset = new Vector2(62, 180);

  constructor(app, grid) {
    super();
    this.grid = grid;
    this.sprite = new AnimatedSprite(
      getSpritesheetAnimation("character", "idle")
    );
    this.sprite.width *= this.grid.widthRatio;
    this.sprite.height *= this.grid.heightRatio;
    this.offset.x *= this.grid.widthRatio;
    this.offset.y *= this.grid.heightRatio;
    this.offset = this.offset.sub(this.grid.tileCenterOffset);
    this.addChild(this.sprite);

    this.currentCoord = new Vector3(3, 0, 3);
    this.grid.addBuddy(this, this.currentCoord);

    {
      const blackboard = {
        lock: "none",
        agentData: this,
        runningNode: null,
        previousCoord: new Vector3(),
        nextCoord: new Vector3(),
        pathFound: false,
        path: [],
        adjacentTiles: [],
        idle: {
          timer: 0,
          rate: secondToTick(3),
        },
        move: {
          timer: 0,
          rate: secondToTick(0.3),
        },
        work: {
          hasWork: false,
          atDesk: false,
        },
      };
      const moveToDeskBehavior = new BehaviorSequence(blackboard);
      moveToDeskBehavior.addChild(
        new BehaviorCondition(blackboard, (b) => {
          if (!b.pathFound) {
            const grid = b.agentData.grid;
            const deskTile = grid.findItem("desk");
            const deskCoord = grid.indexToCoord(deskTile.index);
            if (deskTile) {
              const sitCoord = deskCoord.add(
                deskTile.content.rotationIndexToDirectionVector()
              );
              [b.path, b.pathFound] = grid.pathTo(
                b.agentData.currentCoord,
                sitCoord,
                {
                  includeStart: false,
                  includeEnd: true,
                }
              );
              b.nextCoord = grid.indexToCoord(b.path.pop().index);
            }
          }
          return b.pathFound;
        })
      );
      moveToDeskBehavior.addChild(
        new BehaviorAction(blackboard, (b) => {
          const grid = b.agentData.grid;

          b.move.timer += 1;
          if (b.move.timer === b.move.rate) {
            b.move.timer = 0;
            grid.moveBuddy(b.agentData, b.nextCoord);
            b.previousCoord = b.agentData.currentCoord;
            b.agentData.currentCoord = b.nextCoord;
            b.lock = "none";
            if (b.path.length > 0) {
              b.nextCoord = grid.indexToCoord(b.path.pop().index);
              return false;
            }
            return true;
          }

          const t = b.move.timer / b.move.rate;
          // FIXME: Could optimize this since they are constant across the movement
          const start = grid.coordToWorld(b.agentData.currentCoord);
          const end = grid.coordToWorld(b.nextCoord);
          const v = start.lerp(end, t);
          b.agentData.setPosition(new Vector2(v.x - grid.x, v.y - grid.y));
          b.lock = "work";
          return false;
        })
      );
      moveToDeskBehavior.addChild(
        new BehaviorAction(blackboard, (b) => {
          b.pathFound = false;
          b.work.atDesk = true;
          return true;
        })
      );

      const workBehavior = new BehaviorSequence(blackboard);
      workBehavior.addChild(
        new BehaviorCondition(blackboard, (b) => {
          const filters = ["work", "none"];
          const isLocked = !filters.find((filter) => {
            return filter == b.lock;
          });
          if (!isLocked) {
            return b.work.hasWork;
          }
          return false;
        })
      );
      workBehavior.addChild(
        new BehaviorBranch(
          blackboard,
          new BehaviorCondition(blackboard, (b) => {
            return b.work.atDesk;
          }),
          new BehaviorAction(
            blackboard,
            (b) => {
              b.lock = "none";
              return false;
            },
            (b) => {
              b.lock = "none";
              b.work.atDesk = false;
            }
          ),
          moveToDeskBehavior
        )
      );

      const idleBehavior = new BehaviorSequence(blackboard);
      idleBehavior.addChild(
        new BehaviorCondition(blackboard, (b) => {
          b.idle.timer += 1;
          if (b.idle.timer >= b.idle.rate) {
            return true;
          }
          return false;
        })
      );
      idleBehavior.addChild(
        new BehaviorCondition(blackboard, (b) => {
          if (!b.pathFound) {
            const grid = b.agentData.grid;
            const previousIndex = grid.coordToIndex(b.previousCoord);
            b.adjacentTiles = grid.adjacentTiles(b.agentData.currentCoord);
            while (!b.pathFound && b.adjacentTiles.length > 0) {
              const rand = Math.floor(Math.random() * b.adjacentTiles.length);
              const tile = b.adjacentTiles.splice(rand, 1)[0];
              if (tile.walkable && tile.index != previousIndex) {
                b.pathFound = true;
                b.nextCoord = grid.indexToCoord(tile.index);
                break;
              }
            }
          }

          return b.pathFound;
        })
      );
      idleBehavior.addChild(
        new BehaviorAction(blackboard, (b) => {
          const grid = b.agentData.grid;

          b.move.timer += 1;
          if (b.move.timer === b.move.rate) {
            b.move.timer = 0;
            grid.moveBuddy(b.agentData, b.nextCoord);
            b.previousCoord = b.agentData.currentCoord;
            b.agentData.currentCoord = b.nextCoord;
            b.lock = "none";
            return true;
          }
          const t = b.move.timer / b.move.rate;
          // FIXME: Could optimize this since they are constant across the movement
          const start = grid.coordToWorld(b.agentData.currentCoord);
          const end = grid.coordToWorld(b.nextCoord);

          const v = start.lerp(end, t);
          b.agentData.setPosition(new Vector2(v.x - grid.x, v.y - grid.y));
          b.lock = "idle";
          return false;
        })
      );
      idleBehavior.addChild(
        new BehaviorAction(blackboard, (b) => {
          b.idle.timer = 0;
          b.pathFound = false;
          return true;
        })
      );
      this.agent.blackboard = blackboard;

      const root = new BehaviorSequence(blackboard, BehaviorResult.Success);
      root.addChild(workBehavior);
      root.addChild(idleBehavior);
      this.agent.setRoot(root);
    }

    this.setSignalListeners();

    const update = () => {
      this.agent.run();
    };
    app.ticker.add(update);
  }

  setSignalListeners() {
    SignalDispatcher.addListener("interrupt.work", () => {
      this.agent.blackboard.work.hasWork = true;
      this.agent.interrupt();
    });
    SignalDispatcher.addListener("interrupt.break", () => {
      this.agent.blackboard.work.hasWork = false;
      this.agent.interrupt();
    });
  }

  setPosition(pos) {
    this.x = pos.x - this.offset.x;
    this.y = pos.y - this.offset.y;
  }
}

class BehaviorTree {
  blackboard = {};
  root = null;

  constructor() {}

  setRoot(node) {
    this.root = node;
  }

  run() {
    let result = BehaviorResult.Success;
    if (this.root) {
      result = this.root.execute();
    }
    return result;
  }

  interrupt() {
    if (this.blackboard.runningNode && this.blackboard.runningNode.cleanup) {
      this.blackboard.runningNode.interrupt();
    }
  }
}

const BehaviorResult = {
  Success: 0,
  Failure: 1,
  Processing: 2,
  Error: 3,
};

class BehaviorSequence {
  kind = "sequence";
  blackboard = null;
  children = [];
  exitCode = BehaviorResult.Failure;

  constructor(blackboard, exitCode = BehaviorResult.Failure) {
    this.blackboard = blackboard;
    this.exitCode = exitCode;
    if (this.exitCode == BehaviorResult.Success) {
      this.kind = "selector";
    }
  }

  addChild(node) {
    this.children.push(node);
  }

  execute() {
    let result = BehaviorResult.Success;
    for (let i = 0; i < this.children.length; i += 1) {
      const child = this.children[i];
      result = child.execute();

      if (result === this.exitCode || result === BehaviorResult.Processing) {
        break;
      }
    }

    return result;
  }
}

class BehaviorBranch {
  kind = "branch";
  blackboard = null;

  constructor(blackboard, predicate, left, right) {
    this.predicate = predicate;
    this.left = left;
    this.right = right;
  }

  execute() {
    switch (this.predicate.execute()) {
      case BehaviorResult.Success:
        return this.left.execute();
      case BehaviorResult.Failure:
        return this.right.execute();
      default:
        return BehaviorResult.Error;
    }
  }
}

class BehaviorCondition {
  kind = "condition";

  constructor(blackboard, callback) {
    this.blackboard = blackboard;
    this.callback = callback;
  }

  execute() {
    const ok = this.callback(this.blackboard);
    return ok ? BehaviorResult.Success : BehaviorResult.Failure;
  }
}

class BehaviorAction {
  kind = "action";

  constructor(blackboard, callback, cleanup) {
    this.blackboard = blackboard;
    this.callback = callback;
    this.cleanup = cleanup;
  }

  execute() {
    const done = this.callback(this.blackboard);
    if (done) {
      return BehaviorResult.Success;
    } else {
      this.blackboard.runningNode = this;
      return BehaviorResult.Processing;
    }
  }

  interrupt() {
    this.cleanup(this.blackboard);
  }
}
