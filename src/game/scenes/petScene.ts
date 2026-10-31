import Phaser from 'phaser';

type PetMode = 'idle' | 'happy' | 'eating' | 'sleeping';

export function createPetScene(parent: HTMLElement) {
  class RoomScene extends Phaser.Scene {
    private pet?: Phaser.GameObjects.Graphics;
    private petMode: PetMode = 'idle';
    private actionVersion = 0;
    constructor() { super('room'); }
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

      this.pet = this.add.graphics();
      this.paintPet();
      this.positionPet(width, height);
      this.tweens.add({ targets: this.pet, y: this.pet.y - 5, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.scale.on('resize', (size: Phaser.Structs.Size) => this.positionPet(size.width, size.height));
    }
    react(action: string) {
      if (!this.pet) return;
      this.petMode = action === 'feed' ? 'eating' : action === 'sleep' ? 'sleeping' : 'happy';
      this.paintPet();
      const version = ++this.actionVersion;
      this.time.delayedCall(1400, () => {
        if (version !== this.actionVersion) return;
        this.petMode = 'idle';
        this.paintPet();
      });
      this.tweens.killTweensOf(this.pet);
      this.tweens.add({ targets: this.pet, scale: this.pet.scale * 1.06, duration: 150, yoyo: true, ease: 'Back.Out' });
    }
    private positionPet(width: number, height: number) {
      this.pet?.setPosition(width * 0.5 - 96, height * 0.52 - 80);
    }
    private paintPet() {
      if (!this.pet) return;
      const pixel = 8;
      const outline = 0x4a243e;
      const pink = 0xf28da9;
      const lightPink = 0xffb5c7;
      const gillRed = 0xe44769;
      const belly = 0xffdfce;
      const eye = 0x312039;
      const cheek = 0xf47791;
      const put = (x: number, y: number, color: number) => {
        this.pet!.fillStyle(color, 1);
        this.pet!.fillRect(x * pixel, y * pixel, pixel, pixel);
      };

      this.pet.clear();

      // Silueta del cuerpo: los píxeles se calculan desde una elipse y un borde interior.
      for (let y = 3; y <= 16; y++) {
        for (let x = 3; x <= 20; x++) {
          const d = ((x - 11.5) / 8.7) ** 2 + ((y - 9.5) / 6.5) ** 2;
          if (d <= 1) put(x, y, d > 0.76 ? outline : lightPink);
        }
      }

      // Pancita y pequeñas sombras para que conserve volumen en estilo pixel art.
      for (let y = 10; y <= 14; y++) {
        for (let x = 8; x <= 15; x++) {
          if (((x - 11.5) / 4.2) ** 2 + ((y - 11.8) / 3.2) ** 2 <= 1) put(x, y, belly);
        }
      }
      [[5, 6], [6, 5], [17, 5], [18, 6], [4, 12], [19, 12], [8, 15], [15, 15]].forEach(([x, y]) => put(x, y, pink));

      // Branquias exteriores en tres ramas por lado.
      const gills = [
        [3, 5], [2, 4], [1, 3], [0, 2], [3, 8], [2, 8], [1, 8], [0, 8],
        [3, 11], [2, 12], [1, 13], [0, 14], [20, 5], [21, 4], [22, 3], [23, 2],
        [20, 8], [21, 8], [22, 8], [23, 8], [20, 11], [21, 12], [22, 13], [23, 14],
      ];
      gills.forEach(([x, y]) => put(x, y, outline));
      [[2, 5], [1, 4], [0, 3], [2, 8], [1, 8], [0, 8], [2, 11], [1, 12], [0, 13],
        [21, 5], [22, 4], [23, 3], [21, 8], [22, 8], [23, 8], [21, 11], [22, 12], [23, 13]]
        .forEach(([x, y]) => put(x, y, gillRed));

      // Cola y patas, dibujadas como bloques para mantener el acabado pixelado.
      [[18, 13], [19, 14], [20, 15], [21, 16], [22, 16], [23, 15], [22, 14]].forEach(([x, y]) => put(x, y, outline));
      [[19, 13], [20, 14], [21, 15], [22, 15], [22, 14]].forEach(([x, y]) => put(x, y, pink));
      [[7, 15], [7, 16], [8, 17], [9, 17], [14, 15], [14, 16], [15, 17], [16, 17]].forEach(([x, y]) => put(x, y, outline));
      [[8, 16], [9, 16], [15, 16], [16, 16]].forEach(([x, y]) => put(x, y, pink));

      // Cara expresiva: cambia con la acción sin cambiar de imagen ni de personaje.
      put(7, 8, cheek); put(17, 8, cheek);
      if (this.petMode === 'sleeping') {
        [[8, 8], [9, 8], [14, 8], [15, 8]].forEach(([x, y]) => put(x, y, eye));
        [[9, 10], [10, 11], [11, 11], [12, 11], [13, 10]].forEach(([x, y]) => put(x, y, outline));
        put(19, 2, 0x8ec9e8); put(20, 1, 0x8ec9e8); put(21, 1, 0x8ec9e8);
      } else {
        [[8, 7], [9, 7], [8, 8], [9, 8], [14, 7], [15, 7], [14, 8], [15, 8]].forEach(([x, y]) => put(x, y, eye));
        put(8, 7, 0xffffff); put(14, 7, 0xffffff);
        if (this.petMode === 'eating') {
          [[10, 10], [11, 10], [12, 10], [13, 10], [11, 11], [12, 11]].forEach(([x, y]) => put(x, y, outline));
          [[10, 12], [11, 12], [12, 12], [13, 12]].forEach(([x, y]) => put(x, y, 0xf3ae35));
          [[5, 12], [6, 11], [7, 11], [8, 12], [7, 13]].forEach(([x, y]) => put(x, y, 0xf3ae35));
        } else if (this.petMode === 'happy') {
          [[10, 10], [11, 11], [12, 11], [13, 10]].forEach(([x, y]) => put(x, y, outline));
          put(11, 10, 0xffffff); put(12, 10, 0xffffff);
        } else {
          [[10, 10], [11, 10], [12, 10], [13, 10]].forEach(([x, y]) => put(x, y, outline));
        }
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
