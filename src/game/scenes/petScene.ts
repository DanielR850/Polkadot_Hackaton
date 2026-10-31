import Phaser from 'phaser';

export function createPetScene(parent: HTMLElement) {
  class RoomScene extends Phaser.Scene {
    private pet?: Phaser.GameObjects.Sprite;
    constructor() { super('room'); }
    preload() {
      this.load.spritesheet(
        'axolotl',
        `${import.meta.env.BASE_URL}assets/pets/axolotl/states.png`,
        { frameWidth: 543, frameHeight: 724 },
      );
    }
    create() {
      const { width, height } = this.scale;
      const graphics = this.add.graphics();
      graphics.fillGradientStyle(0xf7e8ce, 0xf7e8ce, 0xe9d6bc, 0xe9d6bc, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.fillStyle(0xd1b292, 1); graphics.fillRect(0, height * 0.82, width, height * 0.18);
      graphics.fillStyle(0xfff7e8, 0.82); graphics.fillCircle(width * 0.18, height * 0.2, 42);
      graphics.fillStyle(0xf0b8a1, 0.5); graphics.fillCircle(width * 0.18, height * 0.2, 32);
      // Plant pot
      graphics.fillStyle(0x9c705e, 1); graphics.fillRoundedRect(width * 0.78, height * 0.65, 42, 38, 7);
      graphics.fillStyle(0x6f9b70, 1); graphics.fillCircle(width * 0.82, height * 0.57, 17); graphics.fillCircle(width * 0.77, height * 0.6, 13); graphics.fillCircle(width * 0.86, height * 0.61, 12);

      this.pet = this.add.sprite(width * 0.5, height * 0.52, 'axolotl', 0).setDisplaySize(160, 213);
      this.tweens.add({ targets: this.pet, y: this.pet.y - 5, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.scale.on('resize', (size: Phaser.Structs.Size) => this.pet?.setPosition(size.width * 0.5, size.height * 0.52));
    }
    react(action: string) {
      if (!this.pet) return;
      const frame = action === 'feed' ? 2 : action === 'sleep' ? 3 : 1;
      this.pet.setFrame(frame);
      this.time.delayedCall(1400, () => this.pet?.setFrame(0));
      if (action !== 'sleep') {
        this.tweens.add({ targets: this.pet, scale: this.pet.scale * 1.06, duration: 150, yoyo: true, ease: 'Back.Out' });
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: 520, height: 360, backgroundColor: '#f7e8ce',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [RoomScene], pixelArt: true,
  });
  return {
    react: (action: string) => (game.scene.getScene('room') as RoomScene).react(action),
    destroy: () => game.destroy(true),
  };
}
