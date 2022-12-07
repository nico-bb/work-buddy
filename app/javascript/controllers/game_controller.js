import * as PIXI from "pixi.js";
import { Controller } from "@hotwired/stimulus";
import { Grid } from "./game/grid";
import { PlayerController } from "./game/player";
import {
  findAssetInfo,
  getSpritesheetAnimation,
  loadAssets,
} from "./game/assets";
import { Buddy } from "./game/buddy";
import { Vector2, Vector3 } from "./game/math";
import { Item } from "./game/item";
import {
  EmissionShape,
  ParticleEmitter,
  ParticleSystem,
  RotatingHoverItem,
} from "./game/particles";
import { secondToTick } from "./game/utils";

// Connects to data-controller="game"
export default class extends Controller {
  static values = {
    tilesConfig: String,
    tiles: String,
    itemsConfig: String,
    items: String,
    charactersConfig: String,
    characters: String,
    iconsConfig: String,
    icons: String,
  };

  async connect() {
    const tilesSpritesheetPath = this.tilesValue;
    const tilesConfigPath = this.tilesConfigValue;
    const itemsSpritesheetPath = this.itemsValue;
    const itemsConfigPath = this.itemsConfigValue;
    const charactersSpritesheetPath = this.charactersValue;
    const charactersConfigPath = this.charactersConfigValue;
    const iconsSpritesheetPath = this.iconsValue;
    const iconsConfigPath = this.iconsConfigValue;

    let app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      background: 0xffffff,
    });
    // background: 0xf2ecfd,

    document.body.style.margin = "0";
    app.renderer.view.style.position = "absolute";
    app.renderer.view.style.display = "block";

    app.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", (e) => {
      app.renderer.resize(window.innerWidth, window.innerHeight);
    });
    document.body.appendChild(app.view);

    await loadAssets(
      app,
      tilesSpritesheetPath,
      tilesConfigPath,
      itemsSpritesheetPath,
      itemsConfigPath,
      charactersSpritesheetPath,
      charactersConfigPath,
      iconsSpritesheetPath,
      iconsConfigPath
    );
    const grid = new Grid(app, 10, 10, (g) => {
      const insertItem = (name, coord, rotationsCount) => {
        const position = g.coordToWorld(coord);
        const item = new Item(app, findAssetInfo(name));
        item.setScaledSize(
          item.sprite.width * g.widthRatio,
          item.sprite.height * g.heightRatio
        );
        for (let i = 0; i < rotationsCount; i += 1) {
          item.rotateCW();
        }
        item.x = position.x - item.currentOffset.x;
        item.y = position.y - item.currentOffset.y;
        item.y -= g.yValue / 2;
        g.setTileItem(item, coord);
        return item;
      };
      const insertNestedItem = (name, parent, rotationsCount, offset) => {
        const item = new Item(app, findAssetInfo(name));
        item.setScaledSize(
          item.sprite.width * g.widthRatio,
          item.sprite.height * g.heightRatio
        );
        for (let i = 0; i < rotationsCount; i += 1) {
          item.rotateCW();
        }
        item.x = -item.currentOffset.x;
        item.y = -item.currentOffset.y;
        parent.nestItem(item, offset);
      };

      insertItem("desk", new Vector3(4, 0, 1), 1);
      insertItem("rug", new Vector3(9, 0, 5), 0);
      insertItem("couch", new Vector3(1, 0, 5));
      insertItem("fridge", new Vector3(9, 0, 1), 1);
      insertItem("kitchenSink", new Vector3(8, 0, 1), 1);
      insertItem("plant", new Vector3(5, 0, 1));
      insertItem("plant", new Vector3(1, 0, 4), 1);

      const table = insertItem("coffeeTable", new Vector3(3, 0, 5));
      insertNestedItem("tv", table, 2, new Vector2(0, 10));
    });
    app.stage.addChild(grid);

    const playerController = new PlayerController(app);
    const buddy = new Buddy(app, grid);

    // const particleSystem = new ParticleSystem(app);
    // app.stage.addChild(particleSystem);
    ParticleSystem.init(app);
    // const test = getSpritesheetAnimation("icon", "emote_anger");
    // {
    //   ParticleSystem.addEmitter(
    //     new ParticleEmitter(test, new Vector2(100, 100), {
    //       shape: EmissionShape.Cone,
    //       coneAngle: 45,
    //       coneDir: new Vector2(0, -1),
    //       maxBurstCount: 4,
    //       burstRate: secondToTick(3),
    //       burstCapacity: 50,
    //       burstForce: 50,
    //       burstMinLifetime: secondToTick(3),
    //       burstMaxLifetime: secondToTick(4),
    //     })
    //   );
    // }

    // {
    //   const wateringCan = getSpritesheetAnimation("item", "watering_can");
    //   ParticleSystem.addEmitter(
    //     new RotatingHoverItem(
    //       wateringCan,
    //       new Vector2(100, 100),
    //       -90,
    //       secondToTick(5)
    //     )
    //   );
    // }
  }
}
