import Phaser from 'phaser';

export function createPetScene(parent: HTMLElement) {
  class RoomScene extends Phaser.Scene {
    private pet?: Phaser.GameObjects.Container;
    constructor() { super('room'); }
    create() {
      const { width, height } = this.scale;
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0xf7e8ce, 0xf7e8ce, 0xe9d6bc, 0xe9d6bc, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.fillStyle(0xd1b292, 1); graphics.fillRect(0, height * 0.78, width, height * 0.22);
      graphics.fillStyle(0xfff7e8, 0.82); graphics.fillCircle(width * 0.18, height * 0.2, 42);
      graphics.fillStyle(0xf0b8a1, 0.5); graphics.fillCircle(width * 0.18, height * 0.2, 32);
      // Plant pot
      graphics.fillStyle(0x9c705e, 1); graphics.fillRoundedRect(width * 0.78, height * 0.65, 42, 38, 7);
      graphics.fillStyle(0x6f9b70, 1); graphics.fillCircle(width * 0.82, height * 0.57, 17); graphics.fillCircle(width * 0.77, height * 0.6, 13); graphics.fillCircle(width * 0.86, height * 0.61, 12);

      const body = this.add.ellipse(0, 8, 122, 112, 0x8b79c5).setStrokeStyle(4, 0x615196);
      const belly = this.add.ellipse(0, 28, 72, 56, 0xb7a9e3);
      const leftEye = this.add.ellipse(-23, -7, 10, 14, 0x302b43);
      const rightEye = this.add.ellipse(23, -7, 10, 14, 0x302b43);
      const blushL = this.add.ellipse(-40, 10, 16, 8, 0xe995a7, 0.75);
      const blushR = this.add.ellipse(40, 10, 16, 8, 0xe995a7, 0.75);
      const mouth = this.add.arc(0, 8, 9, 15, 145, false).setStrokeStyle(2.5, 0x51405b);
      const earL = this.add.ellipse(-47, -42, 31, 43, 0x8b79c5).setAngle(-24).setStrokeStyle(3, 0x615196);
      const earR = this.add.ellipse(47, -42, 31, 43, 0x8b79c5).setAngle(24).setStrokeStyle(3, 0x615196);
      this.pet = this.add.container(width * 0.5, height * 0.52, [earL, earR, body, belly, blushL, blushR, leftEye, rightEye, mouth]);
      this.tweens.add({ targets: this.pet, y: this.pet.y - 7, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.scale.on('resize', (size: Phaser.Structs.Size) => this.pet?.setPosition(size.width * 0.5, size.height * 0.52));
    }
    react(action: string) {
      if (!this.pet) return;
      if (action === 'sleep') { this.pet.setAlpha(0.72); this.time.delayedCall(1500, () => this.pet?.setAlpha(1)); }
      else this.tweens.add({ targets: this.pet, scale: 1.12, duration: 140, yoyo: true, ease: 'Back.Out' });
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 520, height: 360, backgroundColor: '#f7e8ce',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [RoomScene], render: { antialias: true, roundPixels: true },
  });
  return {
    react: (action: string) => (game.scene.getScene('room') as RoomScene).react(action),
    destroy: () => game.destroy(true),
  };
}
