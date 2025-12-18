export class InputManager {
    constructor() {
        this.keyState = {
            w: false,
            a: false,
            s: false,
            s: false,
            s: false,
            d: false,
            q: false,
            e: false,
            b: false,
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };
        this.onEscape = null;
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => {
            switch (e.key.toLowerCase()) {
                case 'w': this.keyState.w = true; break;
                case 'a': this.keyState.a = true; break;
                case 's': this.keyState.s = true; break;
                case 'd': this.keyState.d = true; break;
                case 'q': this.keyState.q = true; break;
                case 'e': this.keyState.e = true; break;
                case 'b': this.keyState.b = true; break;
                case 'arrowup': this.keyState.ArrowUp = true; break;
                case 'arrowdown': this.keyState.ArrowDown = true; break;
                case 'arrowleft': this.keyState.ArrowLeft = true; break;
                case 'arrowright': this.keyState.ArrowRight = true; break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.key.toLowerCase()) {
                case 'w': this.keyState.w = false; break;
                case 'a': this.keyState.a = false; break;
                case 's': this.keyState.s = false; break;
                case 'd': this.keyState.d = false; break;
                case 'q': this.keyState.q = false; break;
                case 'e': this.keyState.e = false; break;
                case 'b': this.keyState.b = false; break;
                case 'arrowup': this.keyState.ArrowUp = false; break;
                case 'arrowdown': this.keyState.ArrowDown = false; break;
                case 'arrowleft': this.keyState.ArrowLeft = false; break;
                case 'arrowright': this.keyState.ArrowRight = false; break;
            }
        });

        window.addEventListener('keydown', (event) => {
            if (event.code === 'Escape') {
                if (this.onEscape) this.onEscape();
            }
        });
    }

    getKeys() {
        return this.keyState;
    }
}
