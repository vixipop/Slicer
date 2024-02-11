const { Project, Scene3D, PhysicsLoader } = ENABLE3D;

class MainScene extends Scene3D {
  constructor() {
    super({ key: "MainScene" });
  }

  create() {
    this.warpSpeed();

    // we have 4 groups
    // default    0001  (1)
    // red        0010  (2)
    // blue       0100  (4)
    // green      1000  (8)

    // the ground is by default in the default group
    // pink boxes
    setTimeout(() => {
      for (let i = 0; i < 20; i++) {
        const x = this.randomPosition(),
          y = this.randomHeight(0),
          z = this.randomPosition();

        const collisionGroup = 8,
          collisionMask = 9; // 1 + 8

        const box = this.physics.add.box(
          { x, y, z, collisionGroup, collisionMask },
          { lambert: { color: "pink" } }
        );
        box.body.setBounciness(0.8);
      }
    }, 2000);
  }

  randomPosition() {
    return (Math.random() - 0.5) * 5;
  }

  randomHeight(offset = 0) {
    return Math.random() * 10 + 5 + offset;
  }
}

PhysicsLoader("/lib/ammo/kripken", () => {
  new Project({ scenes: [MainScene] });
});
