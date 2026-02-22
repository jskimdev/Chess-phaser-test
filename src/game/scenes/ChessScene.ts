import { Scene, type GameObjects, type Input } from 'phaser';
import { EventBus } from '../EventBus';

type PieceColor = 'w' | 'b';
type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
type BoardMode = 'desktop' | 'mobile';

type Piece = {
    color: PieceColor;
    type: PieceType;
    moved: boolean;
    hp: number;
    maxHp: number;
};

type Square = {
    row: number;
    col: number;
};

type Move = Square & {
    special?: 'castle' | 'en-passant';
    rookFromCol?: number;
    rookToCol?: number;
};

type LastMove = {
    from: Square;
    to: Square;
    piece: Piece;
    wasDoublePawnStep: boolean;
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const BACK_RANK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const PIECE_HP: Record<PieceType, number> = {
    p: 2,
    n: 3,
    b: 3,
    r: 4,
    q: 5,
    k: 7
};
const PIECE_DAMAGE: Record<PieceType, number> = {
    p: 1,
    n: 2,
    b: 2,
    r: 3,
    q: 3,
    k: 2
};

const PIECE_MASKS: Record<PieceType, string[]> = {
    p: [
        '......XX......',
        '.....XXXX.....',
        '.....XXXX.....',
        '......XX......',
        '.....XXXX.....',
        '....XXXXXX....',
        '....XXXXXX....',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '..XXXXXXXXXX..',
        '..XXXXXXXXXX..',
        '...XXXXXXXX...',
        '....XXXXXX....',
        '................',
        '................'
    ],
    r: [
        '...XX.XX.XX....',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '....XXXXXX.....',
        '....XXXXXX.....',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '..XXXXXXXXXX...',
        '..XXXXXXXXXX...',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '................',
        '................'
    ],
    n: [
        '.....XXXX.......',
        '....XXXXXX......',
        '...XXXXXXXX.....',
        '...XXXXXXXX.....',
        '...XXXX.........',
        '...XXXXXXX......',
        '...XXXXXXXX.....',
        '...XXXXXXXX.....',
        '...XXXXXXXX.....',
        '...XXXXXXXXX....',
        '...XXXXXXXXXX...',
        '...XXXXXXXXXX...',
        '...XXXXXXXX.....',
        '..XXXXXXXX......',
        '................',
        '................'
    ],
    b: [
        '......XX......',
        '.....XXXX.....',
        '.....XXXX.....',
        '....XXXXXX....',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '....XXXXXX....',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '..XXXXXXXXXX..',
        '..XXXXXXXXXX..',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '....XXXXXX....',
        '................',
        '................'
    ],
    q: [
        '...XX.XX.XX....',
        '..XXXXXXXXXX...',
        '..XXXXXXXXXX...',
        '...XXXXXXXX....',
        '...XXXXXXXX....',
        '....XXXXXX.....',
        '...XXXXXXXX....',
        '..XXXXXXXXXX...',
        '..XXXXXXXXXX...',
        '..XXXXXXXXXX...',
        '.XXXXXXXXXXXX..',
        '.XXXXXXXXXXXX..',
        '..XXXXXXXXXX...',
        '...XXXXXXXX....',
        '................',
        '................'
    ],
    k: [
        '......XX......',
        '......XX......',
        '.....XXXX.....',
        '..XXXXXXXXXX..',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '....XXXXXX....',
        '...XXXXXXXX...',
        '..XXXXXXXXXX..',
        '..XXXXXXXXXX..',
        '..XXXXXXXXXX..',
        '..XXXXXXXXXX..',
        '...XXXXXXXX...',
        '...XXXXXXXX...',
        '................',
        '................'
    ]
};

export class ChessScene extends Scene
{
    private board: (Piece | null)[][] = [];
    private turn: PieceColor = 'w';
    private boardMode: BoardMode = 'desktop';
    private gameState: 'active' | 'checkmate' | 'stalemate' = 'active';
    private selected: Square | null = null;
    private legalMoves: Move[] = [];
    private lastMove: LastMove | null = null;
    private isResolvingMove = false;
    private boardX = 0;
    private boardY = 0;
    private boardSize = 576;
    private cellSize = 72;
    private backgroundGraphics!: GameObjects.Graphics;
    private boardGraphics!: GameObjects.Graphics;
    private highlightGraphics!: GameObjects.Graphics;
    private piecesLayer!: GameObjects.Container;
    private labelsLayer!: GameObjects.Container;
    private statusText!: GameObjects.Text;
    private helperText!: GameObjects.Text;

    constructor ()
    {
        super('ChessScene');
    }

    create ()
    {
        this.createPieceTextures();
        this.resetGame();
        this.createSceneLayers();
        this.layoutBoard();
        this.render();

        this.input.on('pointerdown', this.onPointerDown, this);
        this.scale.on('resize', this.layoutBoard, this);
        EventBus.on('board-size-mode', this.setBoardMode, this);
        EventBus.emit('current-scene-ready', this);

        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.scale.off('resize', this.layoutBoard, this);
            EventBus.off('board-size-mode', this.setBoardMode, this);
        });
    }

    private resetGame ()
    {
        this.board = this.createInitialBoard();
        this.turn = 'w';
        this.gameState = 'active';
        this.selected = null;
        this.legalMoves = [];
        this.lastMove = null;
    }

    private createSceneLayers ()
    {
        this.backgroundGraphics = this.add.graphics().setDepth(-10);
        this.boardGraphics = this.add.graphics().setDepth(1);
        this.highlightGraphics = this.add.graphics().setDepth(3);
        this.piecesLayer = this.add.container(0, 0).setDepth(4);
        this.labelsLayer = this.add.container(0, 0).setDepth(2);

        this.statusText = this.add.text(0, 18, '', {
            fontFamily: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
            fontSize: '34px',
            color: '#f3e4cb',
            stroke: '#25180f',
            strokeThickness: 5
        }).setOrigin(0.5, 0).setDepth(6);

        this.helperText = this.add.text(0, 0, '', {
            fontFamily: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
            fontSize: '14px',
            color: '#c9b18a'
        }).setOrigin(0.5, 1).setDepth(6);
    }

    private layoutBoard ()
    {
        const width = this.scale.width;
        const height = this.scale.height;
        const topSpace = 104;
        const bottomSpace = 66;
        const maxBoardByWidth = width - 40;
        const maxBoardByHeight = height - topSpace - bottomSpace;
        const targetBoard = this.boardMode === 'desktop' ? 680 : 440;
        const bounded = Math.max(280, Math.min(targetBoard, maxBoardByWidth, maxBoardByHeight));

        this.cellSize = Math.floor(bounded / 8);
        this.boardSize = this.cellSize * 8;
        this.boardX = Math.floor((width - this.boardSize) / 2);
        this.boardY = Math.floor((height - this.boardSize) / 2) + 12;

        this.statusText.setPosition(width * 0.5, 18);
        this.helperText.setPosition(width * 0.5, height - 14);

        this.drawBackground(width, height);
        this.render();
    }

    private drawBackground (width: number, height: number)
    {
        this.backgroundGraphics.clear();
        this.backgroundGraphics.fillGradientStyle(0x0f1a2d, 0x1e2d4a, 0x25180f, 0x1e2d4a, 1);
        this.backgroundGraphics.fillRect(0, 0, width, height);

        this.backgroundGraphics.lineStyle(2, 0x8f6f47, 0.16);
        for (let i = -height; i < width + height; i += 48)
        {
            this.backgroundGraphics.lineBetween(i, 0, i + height, height);
        }
    }

    private render ()
    {
        this.drawBoard();
        this.drawHighlights();
        this.drawPieces();
        this.updateStatus();
    }

    private drawBoard ()
    {
        this.boardGraphics.clear();
        this.labelsLayer.removeAll(true);

        const framePad = Math.floor(this.cellSize * 0.24);
        this.boardGraphics.fillStyle(0x3a2414, 1);
        this.boardGraphics.fillRoundedRect(
            this.boardX - framePad,
            this.boardY - framePad,
            this.boardSize + framePad * 2,
            this.boardSize + framePad * 2,
            Math.max(10, Math.floor(this.cellSize * 0.2))
        );
        this.boardGraphics.lineStyle(3, 0xe3c28f, 0.65);
        this.boardGraphics.strokeRoundedRect(
            this.boardX - framePad,
            this.boardY - framePad,
            this.boardSize + framePad * 2,
            this.boardSize + framePad * 2,
            Math.max(10, Math.floor(this.cellSize * 0.2))
        );

        for (let row = 0; row < 8; row++)
        {
            for (let col = 0; col < 8; col++)
            {
                const isLight = (row + col) % 2 === 0;
                this.boardGraphics.fillStyle(isLight ? 0xf0d9b5 : 0xb58863, 1);
                this.boardGraphics.fillRect(
                    this.boardX + col * this.cellSize,
                    this.boardY + row * this.cellSize,
                    this.cellSize,
                    this.cellSize
                );
            }
        }

        for (let i = 0; i < 8; i++)
        {
            const fileText = this.add.text(
                this.boardX + i * this.cellSize + this.cellSize * 0.5,
                this.boardY + this.boardSize + 8,
                FILES[i],
                {
                    fontFamily: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
                    fontSize: `${Math.max(12, Math.floor(this.cellSize * 0.22))}px`,
                    color: '#e3c28f'
                }
            ).setOrigin(0.5, 0);
            this.labelsLayer.add(fileText);

            const rankText = this.add.text(
                this.boardX - 10,
                this.boardY + i * this.cellSize + this.cellSize * 0.5,
                `${8 - i}`,
                {
                    fontFamily: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
                    fontSize: `${Math.max(12, Math.floor(this.cellSize * 0.22))}px`,
                    color: '#e3c28f'
                }
            ).setOrigin(1, 0.5);
            this.labelsLayer.add(rankText);
        }
    }

    private drawHighlights ()
    {
        this.highlightGraphics.clear();

        if (this.selected)
        {
            this.highlightGraphics.lineStyle(4, 0x2fcb78, 0.95);
            this.highlightGraphics.strokeRect(
                this.boardX + this.selected.col * this.cellSize + 2,
                this.boardY + this.selected.row * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
        }

        for (const move of this.legalMoves)
        {
            const target = this.board[move.row][move.col];
            const cx = this.boardX + move.col * this.cellSize + this.cellSize * 0.5;
            const cy = this.boardY + move.row * this.cellSize + this.cellSize * 0.5;

            if (target)
            {
                this.highlightGraphics.lineStyle(4, 0xf15555, 0.9);
                this.highlightGraphics.strokeRect(
                    this.boardX + move.col * this.cellSize + 3,
                    this.boardY + move.row * this.cellSize + 3,
                    this.cellSize - 6,
                    this.cellSize - 6
                );
            }
            else
            {
                this.highlightGraphics.fillStyle(0x2fcb78, 0.52);
                this.highlightGraphics.fillCircle(cx, cy, Math.max(4, Math.floor(this.cellSize * 0.12)));
            }
        }

        if (this.gameState === 'active')
        {
            const inCheckSquare = this.getKingSquare(this.board, this.turn);
            if (inCheckSquare && this.isKingInCheck(this.board, this.turn))
            {
                this.highlightGraphics.fillStyle(0xf15555, 0.35);
                this.highlightGraphics.fillRect(
                    this.boardX + inCheckSquare.col * this.cellSize,
                    this.boardY + inCheckSquare.row * this.cellSize,
                    this.cellSize,
                    this.cellSize
                );
            }
        }
    }

    private drawPieces ()
    {
        this.piecesLayer.removeAll(true);

        const piecePixel = Math.max(20, Math.floor(this.cellSize * 0.82));
        const hpBarWidth = Math.max(14, Math.floor(this.cellSize * 0.58));
        const hpBarHeight = Math.max(3, Math.floor(this.cellSize * 0.08));

        for (let row = 0; row < 8; row++)
        {
            for (let col = 0; col < 8; col++)
            {
                const piece = this.board[row][col];
                if (!piece)
                {
                    continue;
                }

                const sprite = this.add.image(
                    this.boardX + col * this.cellSize + this.cellSize * 0.5,
                    this.boardY + row * this.cellSize + this.cellSize * 0.5,
                    `piece-${piece.color}-${piece.type}`
                );

                sprite.setDisplaySize(piecePixel, piecePixel);
                this.piecesLayer.add(sprite);

                const barY = this.boardY + row * this.cellSize + this.cellSize * 0.84;
                const barX = this.boardX + col * this.cellSize + this.cellSize * 0.5;
                const hpRatio = Math.max(0, Math.min(1, piece.hp / piece.maxHp));
                const hpColor =
                    hpRatio > 0.6
                        ? 0x30d170
                        : hpRatio > 0.3
                            ? 0xf0ad31
                            : 0xe25353;

                const hpBg = this.add.rectangle(barX, barY, hpBarWidth, hpBarHeight, 0x1a1a1a, 0.72);
                this.piecesLayer.add(hpBg);

                const hpFill = this.add.rectangle(
                    barX - hpBarWidth * 0.5 + (hpBarWidth * hpRatio) * 0.5,
                    barY,
                    Math.max(1, hpBarWidth * hpRatio),
                    hpBarHeight,
                    hpColor,
                    0.95
                );
                this.piecesLayer.add(hpFill);
            }
        }
    }

    private updateStatus ()
    {
        const currentTurn = this.turn === 'w' ? 'White' : 'Black';
        const modeLabel = this.boardMode === 'desktop' ? 'Desktop View' : 'Mobile View';

        if (this.gameState === 'checkmate')
        {
            const winner = this.turn === 'w' ? 'Black' : 'White';
            this.statusText.setText(`Checkmate \u2022 ${winner} wins`);
        }
        else if (this.gameState === 'stalemate')
        {
            this.statusText.setText('Stalemate');
        }
        else if (this.isKingInCheck(this.board, this.turn))
        {
            this.statusText.setText(`${currentTurn} to move \u2022 Check`);
        }
        else
        {
            this.statusText.setText(`${currentTurn} to move`);
        }

        this.helperText.setText(`Pieces have HP and deal damage on attack \u2022 ${modeLabel} \u2022 32x32 textures`);
    }

    private onPointerDown (pointer: Input.Pointer)
    {
        if (this.gameState !== 'active' || this.isResolvingMove)
        {
            return;
        }

        const row = Math.floor((pointer.y - this.boardY) / this.cellSize);
        const col = Math.floor((pointer.x - this.boardX) / this.cellSize);

        if (!this.inBounds(row, col))
        {
            this.selected = null;
            this.legalMoves = [];
            this.render();
            return;
        }

        this.handleSquareClick(row, col);
    }

    private handleSquareClick (row: number, col: number)
    {
        const clickedPiece = this.board[row][col];

        if (this.selected)
        {
            const selectedMove = this.legalMoves.find((move) => move.row === row && move.col === col);
            if (selectedMove)
            {
                void this.commitMove(this.selected, selectedMove);
                return;
            }
        }

        if (clickedPiece && clickedPiece.color === this.turn)
        {
            this.selected = { row, col };
            this.legalMoves = this.getLegalMoves(this.board, this.selected);
        }
        else
        {
            this.selected = null;
            this.legalMoves = [];
        }

        this.render();
    }

    private async commitMove (from: Square, move: Move)
    {
        if (this.isResolvingMove)
        {
            return;
        }

        const originPiece = this.board[from.row][from.col];
        if (!originPiece)
        {
            return;
        }

        this.isResolvingMove = true;
        this.selected = null;
        this.legalMoves = [];

        try
        {
            const nextBoard = this.cloneBoard(this.board);
            let nextPieceState: Piece = { ...originPiece };
            let lastMoveTo: Square = { ...from };
            let wasDoublePawnStep = false;

            const defenderSquare = this.getDefenderSquareForMove(this.board, move, originPiece);
            const defender = defenderSquare ? this.board[defenderSquare.row][defenderSquare.col] : null;

            if (defenderSquare && defender && defender.color !== originPiece.color)
            {
                const damage = this.getPieceDamage(originPiece.type);
                const lethal = defender.hp - damage <= 0;

                await this.playAttackAnimation(from, move, defenderSquare, damage, lethal);

                const defenderOnBoard = nextBoard[defenderSquare.row][defenderSquare.col];
                if (defenderOnBoard)
                {
                    defenderOnBoard.hp = Math.max(0, defenderOnBoard.hp - damage);
                }

                if (defenderOnBoard && defenderOnBoard.hp <= 0)
                {
                    nextBoard[defenderSquare.row][defenderSquare.col] = null;
                    nextPieceState = this.movePieceWithPromotion(nextBoard, from, move);
                    lastMoveTo = { row: move.row, col: move.col };
                    wasDoublePawnStep = originPiece.type === 'p' && Math.abs(move.row - from.row) === 2;
                }
            }
            else
            {
                nextPieceState = this.movePieceWithPromotion(nextBoard, from, move);
                lastMoveTo = { row: move.row, col: move.col };
                wasDoublePawnStep = originPiece.type === 'p' && Math.abs(move.row - from.row) === 2;
            }

            this.board = nextBoard;
            this.lastMove = {
                from,
                to: lastMoveTo,
                piece: nextPieceState,
                wasDoublePawnStep
            };

            this.turn = this.turn === 'w' ? 'b' : 'w';
            this.evaluateGameState();
            this.render();
        }
        finally
        {
            this.isResolvingMove = false;
        }
    }

    private movePieceWithPromotion (board: (Piece | null)[][], from: Square, move: Move): Piece
    {
        const piece = board[from.row][from.col];
        if (!piece)
        {
            return this.createPiece('w', 'p');
        }

        board[from.row][from.col] = null;

        if (move.special === 'en-passant')
        {
            const captureRow = piece.color === 'w' ? move.row + 1 : move.row - 1;
            board[captureRow][move.col] = null;
        }

        const movedPiece: Piece = { ...piece, moved: true };

        if (movedPiece.type === 'p' && (move.row === 0 || move.row === 7))
        {
            movedPiece.type = 'q';
            movedPiece.maxHp = PIECE_HP.q;
            movedPiece.hp = Math.min(movedPiece.hp, movedPiece.maxHp);
        }

        board[move.row][move.col] = movedPiece;

        if (move.special === 'castle' && move.rookFromCol !== undefined && move.rookToCol !== undefined)
        {
            const rook = board[move.row][move.rookFromCol];
            board[move.row][move.rookFromCol] = null;
            if (rook)
            {
                board[move.row][move.rookToCol] = { ...rook, moved: true };
            }
        }

        return movedPiece;
    }

    private getDefenderSquareForMove (board: (Piece | null)[][], move: Move, attacker: Piece): Square | null
    {
        if (move.special === 'en-passant')
        {
            const captureRow = attacker.color === 'w' ? move.row + 1 : move.row - 1;
            if (!this.inBounds(captureRow, move.col))
            {
                return null;
            }

            const defender = board[captureRow][move.col];
            if (defender && defender.color !== attacker.color)
            {
                return { row: captureRow, col: move.col };
            }

            return null;
        }

        const defender = board[move.row][move.col];
        if (defender && defender.color !== attacker.color)
        {
            return { row: move.row, col: move.col };
        }

        return null;
    }

    private async playAttackAnimation (
        from: Square,
        move: Move,
        defenderSquare: Square,
        damage: number,
        lethal: boolean
    )
    {
        const attacker = this.board[from.row][from.col];
        const defender = this.board[defenderSquare.row][defenderSquare.col];
        if (!attacker || !defender)
        {
            return;
        }

        const start = this.getSquareCenter(from.row, from.col);
        const hit = this.getSquareCenter(defenderSquare.row, defenderSquare.col);
        const landing = this.getSquareCenter(move.row, move.col);
        const piecePixel = Math.max(20, Math.floor(this.cellSize * 0.82));

        const attackerSprite = this.add.image(start.x, start.y, `piece-${attacker.color}-${attacker.type}`)
            .setDisplaySize(piecePixel, piecePixel)
            .setDepth(30);

        const defenderSprite = this.add.image(hit.x, hit.y, `piece-${defender.color}-${defender.type}`)
            .setDisplaySize(piecePixel, piecePixel)
            .setDepth(29);

        const impactFlash = this.add.rectangle(hit.x, hit.y, this.cellSize * 0.9, this.cellSize * 0.9, 0xf15555, 0)
            .setDepth(28);

        const damageText = this.add.text(hit.x, hit.y - this.cellSize * 0.25, `-${damage}`, {
            fontFamily: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif',
            fontSize: `${Math.max(14, Math.floor(this.cellSize * 0.3))}px`,
            color: '#ffd4d4',
            stroke: '#741414',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(31);

        await this.runTween({
            targets: attackerSprite,
            x: hit.x,
            y: hit.y,
            duration: 130,
            ease: 'Quad.easeOut'
        });

        this.cameras.main.shake(110, 0.003);

        this.tweens.add({
            targets: impactFlash,
            alpha: { from: 0.65, to: 0 },
            duration: 170,
            ease: 'Quad.easeOut'
        });

        this.tweens.add({
            targets: damageText,
            y: damageText.y - this.cellSize * 0.28,
            alpha: { from: 1, to: 0 },
            duration: 420,
            ease: 'Quad.easeOut'
        });

        if (lethal)
        {
            await this.runTween({
                targets: defenderSprite,
                alpha: 0,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 140,
                ease: 'Quad.easeOut'
            });

            if (move.row !== defenderSquare.row || move.col !== defenderSquare.col)
            {
                await this.runTween({
                    targets: attackerSprite,
                    x: landing.x,
                    y: landing.y,
                    duration: 110,
                    ease: 'Sine.easeOut'
                });
            }
        }
        else
        {
            await this.runTween({
                targets: defenderSprite,
                x: { from: hit.x + 4, to: hit.x - 4 },
                duration: 35,
                yoyo: true,
                repeat: 2
            });

            await this.runTween({
                targets: attackerSprite,
                x: start.x,
                y: start.y,
                duration: 120,
                ease: 'Sine.easeIn'
            });
        }

        attackerSprite.destroy();
        defenderSprite.destroy();
        impactFlash.destroy();
        damageText.destroy();
    }

    private runTween (config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void>
    {
        return new Promise((resolve) => {
            this.tweens.add({
                ...config,
                onComplete: () => {
                    resolve();
                }
            });
        });
    }

    private evaluateGameState ()
    {
        const canMove = this.hasAnyLegalMove(this.board, this.turn);
        if (canMove)
        {
            this.gameState = 'active';
            return;
        }

        this.gameState = this.isKingInCheck(this.board, this.turn) ? 'checkmate' : 'stalemate';
    }

    private hasAnyLegalMove (board: (Piece | null)[][], color: PieceColor): boolean
    {
        for (let row = 0; row < 8; row++)
        {
            for (let col = 0; col < 8; col++)
            {
                const piece = board[row][col];
                if (piece && piece.color === color)
                {
                    const legal = this.getLegalMoves(board, { row, col });
                    if (legal.length > 0)
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private getLegalMoves (board: (Piece | null)[][], from: Square): Move[]
    {
        const piece = board[from.row][from.col];
        if (!piece)
        {
            return [];
        }

        const pseudoMoves = this.getPseudoMoves(board, from.row, from.col, piece, false);
        return pseudoMoves.filter((move) => !this.isKingInCheck(this.simulateResolvedBoard(board, from, move), piece.color));
    }

    private simulateResolvedBoard (board: (Piece | null)[][], from: Square, move: Move): (Piece | null)[][]
    {
        const nextBoard = this.cloneBoard(board);
        const attacker = nextBoard[from.row][from.col];
        if (!attacker)
        {
            return nextBoard;
        }

        const defenderSquare = this.getDefenderSquareForMove(board, move, attacker);
        const defender = defenderSquare ? nextBoard[defenderSquare.row][defenderSquare.col] : null;

        if (defenderSquare && defender && defender.color !== attacker.color)
        {
            defender.hp = Math.max(0, defender.hp - this.getPieceDamage(attacker.type));
            if (defender.hp <= 0)
            {
                nextBoard[defenderSquare.row][defenderSquare.col] = null;
                this.movePieceWithPromotion(nextBoard, from, move);
            }
        }
        else
        {
            this.movePieceWithPromotion(nextBoard, from, move);
        }

        return nextBoard;
    }

    private getPseudoMoves (
        board: (Piece | null)[][],
        row: number,
        col: number,
        piece: Piece,
        forAttackMap: boolean
    ): Move[]
    {
        const moves: Move[] = [];

        if (piece.type === 'p')
        {
            const direction = piece.color === 'w' ? -1 : 1;
            const startRow = piece.color === 'w' ? 6 : 1;
            const oneForward = row + direction;

            if (!forAttackMap && this.inBounds(oneForward, col) && !board[oneForward][col])
            {
                moves.push({ row: oneForward, col });

                const twoForward = row + direction * 2;
                if (row === startRow && !board[twoForward][col])
                {
                    moves.push({ row: twoForward, col });
                }
            }

            for (const delta of [-1, 1])
            {
                const attackRow = row + direction;
                const attackCol = col + delta;

                if (!this.inBounds(attackRow, attackCol))
                {
                    continue;
                }

                if (forAttackMap)
                {
                    moves.push({ row: attackRow, col: attackCol });
                    continue;
                }

                const target = board[attackRow][attackCol];
                if (target && target.color !== piece.color)
                {
                    moves.push({ row: attackRow, col: attackCol });
                }
            }

            if (!forAttackMap && this.lastMove && this.lastMove.wasDoublePawnStep)
            {
                const enemyPawn = this.lastMove.piece;
                if (
                    enemyPawn.type === 'p' &&
                    enemyPawn.color !== piece.color &&
                    this.lastMove.to.row === row &&
                    Math.abs(this.lastMove.to.col - col) === 1
                )
                {
                    const enPassantRow = row + direction;
                    const enPassantCol = this.lastMove.to.col;
                    if (this.inBounds(enPassantRow, enPassantCol) && !board[enPassantRow][enPassantCol])
                    {
                        moves.push({ row: enPassantRow, col: enPassantCol, special: 'en-passant' });
                    }
                }
            }
        }
        else if (piece.type === 'n')
        {
            const jumps = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of jumps)
            {
                const nextRow = row + dr;
                const nextCol = col + dc;
                if (!this.inBounds(nextRow, nextCol))
                {
                    continue;
                }

                const target = board[nextRow][nextCol];
                if (!target || target.color !== piece.color)
                {
                    moves.push({ row: nextRow, col: nextCol });
                }
            }
        }
        else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q')
        {
            const directions: Array<[number, number]> = [];
            if (piece.type === 'b' || piece.type === 'q')
            {
                directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            }
            if (piece.type === 'r' || piece.type === 'q')
            {
                directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
            }

            for (const [dr, dc] of directions)
            {
                let nextRow = row + dr;
                let nextCol = col + dc;

                while (this.inBounds(nextRow, nextCol))
                {
                    const target = board[nextRow][nextCol];
                    if (!target)
                    {
                        moves.push({ row: nextRow, col: nextCol });
                    }
                    else
                    {
                        if (target.color !== piece.color)
                        {
                            moves.push({ row: nextRow, col: nextCol });
                        }
                        break;
                    }

                    nextRow += dr;
                    nextCol += dc;
                }
            }
        }
        else if (piece.type === 'k')
        {
            for (let dr = -1; dr <= 1; dr++)
            {
                for (let dc = -1; dc <= 1; dc++)
                {
                    if (dr === 0 && dc === 0)
                    {
                        continue;
                    }

                    const nextRow = row + dr;
                    const nextCol = col + dc;
                    if (!this.inBounds(nextRow, nextCol))
                    {
                        continue;
                    }

                    const target = board[nextRow][nextCol];
                    if (!target || target.color !== piece.color)
                    {
                        moves.push({ row: nextRow, col: nextCol });
                    }
                }
            }

            if (!forAttackMap && !piece.moved && !this.isKingInCheck(board, piece.color))
            {
                for (const side of [
                    { rookCol: 7, passCols: [5, 6], kingTargetCol: 6, rookTargetCol: 5 },
                    { rookCol: 0, passCols: [1, 2, 3], kingTargetCol: 2, rookTargetCol: 3 }
                ])
                {
                    const rook = board[row][side.rookCol];
                    if (!rook || rook.type !== 'r' || rook.color !== piece.color || rook.moved)
                    {
                        continue;
                    }

                    const blocked = side.passCols.some((passCol) => board[row][passCol] !== null);
                    if (blocked)
                    {
                        continue;
                    }

                    const enemy = piece.color === 'w' ? 'b' : 'w';
                    const dangerCols = side.kingTargetCol === 6 ? [5, 6] : [3, 2];
                    const underAttack = dangerCols.some((dangerCol) => this.isSquareAttacked(board, row, dangerCol, enemy));
                    if (!underAttack)
                    {
                        moves.push({
                            row,
                            col: side.kingTargetCol,
                            special: 'castle',
                            rookFromCol: side.rookCol,
                            rookToCol: side.rookTargetCol
                        });
                    }
                }
            }
        }

        return moves;
    }

    private isKingInCheck (board: (Piece | null)[][], color: PieceColor): boolean
    {
        const kingSquare = this.getKingSquare(board, color);
        if (!kingSquare)
        {
            return false;
        }

        const enemy = color === 'w' ? 'b' : 'w';
        return this.isSquareAttacked(board, kingSquare.row, kingSquare.col, enemy);
    }

    private isSquareAttacked (
        board: (Piece | null)[][],
        targetRow: number,
        targetCol: number,
        attackingColor: PieceColor
    ): boolean
    {
        for (let row = 0; row < 8; row++)
        {
            for (let col = 0; col < 8; col++)
            {
                const attacker = board[row][col];
                if (!attacker || attacker.color !== attackingColor)
                {
                    continue;
                }

                const attacks = this.getPseudoMoves(board, row, col, attacker, true);
                if (attacks.some((move) => move.row === targetRow && move.col === targetCol))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private getKingSquare (board: (Piece | null)[][], color: PieceColor): Square | null
    {
        for (let row = 0; row < 8; row++)
        {
            for (let col = 0; col < 8; col++)
            {
                const piece = board[row][col];
                if (piece && piece.color === color && piece.type === 'k')
                {
                    return { row, col };
                }
            }
        }

        return null;
    }

    private createInitialBoard (): (Piece | null)[][]
    {
        const board: (Piece | null)[][] = Array.from({ length: 8 }, () =>
            Array.from({ length: 8 }, () => null)
        );

        for (let col = 0; col < 8; col++)
        {
            board[0][col] = this.createPiece('b', BACK_RANK[col]);
            board[1][col] = this.createPiece('b', 'p');
            board[6][col] = this.createPiece('w', 'p');
            board[7][col] = this.createPiece('w', BACK_RANK[col]);
        }

        return board;
    }

    private createPiece (color: PieceColor, type: PieceType): Piece
    {
        return {
            color,
            type,
            moved: false,
            hp: PIECE_HP[type],
            maxHp: PIECE_HP[type]
        };
    }

    private cloneBoard (board: (Piece | null)[][]): (Piece | null)[][]
    {
        return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
    }

    private getPieceDamage (type: PieceType): number
    {
        return PIECE_DAMAGE[type];
    }

    private getSquareCenter (row: number, col: number): { x: number; y: number }
    {
        return {
            x: this.boardX + col * this.cellSize + this.cellSize * 0.5,
            y: this.boardY + row * this.cellSize + this.cellSize * 0.5
        };
    }

    private inBounds (row: number, col: number): boolean
    {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    private setBoardMode (mode: BoardMode)
    {
        if (mode !== 'desktop' && mode !== 'mobile')
        {
            return;
        }

        this.boardMode = mode;
        this.layoutBoard();
    }

    private createPieceTextures ()
    {
        for (const color of ['w', 'b'] as const)
        {
            for (const type of ['p', 'r', 'n', 'b', 'q', 'k'] as const)
            {
                const key = `piece-${color}-${type}`;
                if (this.textures.exists(key))
                {
                    continue;
                }

                const palette =
                    color === 'w'
                        ? { O: '#5a3f27', F: '#f7ead0' }
                        : { O: '#dfc696', F: '#1f2937' };
                const data = this.buildOutlinedMask(PIECE_MASKS[type]);

                const texture = this.textures.createCanvas(key, 32, 32);
                if (!texture)
                {
                    continue;
                }

                const context = texture.context;
                context.clearRect(0, 0, 32, 32);
                context.imageSmoothingEnabled = false;

                for (let row = 0; row < 16; row++)
                {
                    for (let col = 0; col < 16; col++)
                    {
                        const cell = data[row][col];
                        if (cell === '.')
                        {
                            continue;
                        }

                        context.fillStyle = cell === 'F' ? palette.F : palette.O;
                        context.fillRect(col * 2, row * 2, 2, 2);
                    }
                }

                texture.refresh();
            }
        }
    }

    private buildOutlinedMask (mask: string[]): string[]
    {
        const normalized = Array.from({ length: 16 }, (_, row) =>
            (mask[row] ?? '').toUpperCase().replace(/[^X]/g, '.').padEnd(16, '.').slice(0, 16)
        );

        const solid = normalized.map((row) => row.split('').map((cell) => cell === 'X'));
        const outlined = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => '.'));

        for (let row = 0; row < 16; row++)
        {
            for (let col = 0; col < 16; col++)
            {
                if (solid[row][col])
                {
                    outlined[row][col] = 'F';
                }
            }
        }

        for (let row = 0; row < 16; row++)
        {
            for (let col = 0; col < 16; col++)
            {
                if (solid[row][col])
                {
                    continue;
                }

                let touchingSolid = false;
                for (let dr = -1; dr <= 1 && !touchingSolid; dr++)
                {
                    for (let dc = -1; dc <= 1; dc++)
                    {
                        const nextRow = row + dr;
                        const nextCol = col + dc;
                        if (
                            nextRow >= 0 &&
                            nextRow < 16 &&
                            nextCol >= 0 &&
                            nextCol < 16 &&
                            solid[nextRow][nextCol]
                        )
                        {
                            touchingSolid = true;
                            break;
                        }
                    }
                }

                if (touchingSolid)
                {
                    outlined[row][col] = 'O';
                }
            }
        }

        return outlined.map((row) => row.join(''));
    }
}
