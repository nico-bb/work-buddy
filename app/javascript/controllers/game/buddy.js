import { AnimatedSprite, Container } from "pixi.js";
import { getSpritesheetAnimation } from "./assets";
import { Vector2, Vector3 } from "./math";
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

    this.currentCoord = new Vector3(9, 0, 9);
    this.grid.addBuddy(this, this.currentCoord);

    {
      const blackboard = {
        agentData: this,
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
      };
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
            return true;
          }
          const t = b.move.timer / b.move.rate;
          // FIXME: Could optimize this since they are constant across the movement
          const start = grid.coordToWorld(b.agentData.currentCoord);
          const end = grid.coordToWorld(b.nextCoord);

          const v = start.lerp(end, t);
          b.agentData.setPosition(new Vector2(v.x - grid.x, v.y - grid.y));
          console.log(b.agentData.x, b.agentData.y);
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
      this.blackboard = blackboard;
      this.agent.setRoot(idleBehavior);
      console.log(this.agent);
    }

    const update = () => {
      this.agent.run();
    };
    app.ticker.add(update);
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

  constructor(blackboard) {
    this.blackboard = blackboard;
  }

  addChild(node) {
    this.children.push(node);
  }

  execute() {
    let result = BehaviorResult.Success;
    for (let i = 0; i < this.children.length; i += 1) {
      const child = this.children[i];
      result = child.execute();

      if (
        result === BehaviorResult.Failure ||
        result === BehaviorResult.Processing
      ) {
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

  constructor(blackboard, callback) {
    this.blackboard = blackboard;
    this.callback = callback;
  }

  execute() {
    const done = this.callback(this.blackboard);
    return done ? BehaviorResult.Success : BehaviorResult.Processing;
  }
}