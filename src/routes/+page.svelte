<script lang="ts">
    import type { Scene } from 'phaser';
    import PhaserGame, { type TPhaserRef } from '../PhaserGame.svelte';
    import { EventBus } from '../game/EventBus';

    type BoardMode = 'desktop' | 'mobile';

    let phaserRef: TPhaserRef = { game: null, scene: null };
    let boardMode: BoardMode = 'desktop';

    const toggleBoardMode = () => {
        boardMode = boardMode === 'desktop' ? 'mobile' : 'desktop';
        EventBus.emit('board-size-mode', boardMode);
    };

    const onCurrentActiveScene = (_scene: Scene) => {
        EventBus.emit('board-size-mode', boardMode);
    };
</script>

<main class="page">
    <section class="panel">
        <header class="header">
            <div>
                <h1>Phaser Chess</h1>
                <p>Responsive chess board with handcrafted 32x32 piece textures.</p>
            </div>

            <div class="actions">
                <span class="mode-badge {boardMode}">{boardMode === 'desktop' ? 'Desktop View' : 'Mobile View'}</span>
                <button class="toggle-button" on:click={toggleBoardMode}>
                    Switch to {boardMode === 'desktop' ? 'Mobile' : 'Desktop'}
                </button>
            </div>
        </header>

        <div class="stage-shell {boardMode}">
            <PhaserGame bind:phaserRef={phaserRef} currentActiveScene={onCurrentActiveScene} />
        </div>
    </section>
</main>

<style>
    .page {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 24px 16px;
        box-sizing: border-box;
    }

    .panel {
        width: min(1100px, 100%);
        background:
            radial-gradient(circle at 14% 15%, rgba(216, 180, 119, 0.18), transparent 34%),
            radial-gradient(circle at 88% 80%, rgba(108, 150, 197, 0.2), transparent 38%),
            linear-gradient(135deg, rgba(20, 33, 55, 0.88), rgba(40, 22, 13, 0.9));
        border: 1px solid rgba(238, 211, 167, 0.2);
        border-radius: 22px;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
        padding: 20px;
        box-sizing: border-box;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 14px;
    }

    .header h1 {
        margin: 0;
        color: #f5e2bf;
        letter-spacing: 0.04em;
        font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
        font-size: clamp(1.6rem, 3vw, 2.4rem);
    }

    .header p {
        margin: 6px 0 0;
        color: #e2cda5;
        font-size: 0.95rem;
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .mode-badge {
        border-radius: 999px;
        padding: 6px 11px;
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif;
        font-size: 0.8rem;
        letter-spacing: 0.03em;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff2d8;
        background: rgba(97, 63, 33, 0.55);
    }

    .mode-badge.mobile {
        background: rgba(34, 70, 112, 0.6);
    }

    .toggle-button {
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: linear-gradient(130deg, #3d290f, #1e304a);
        color: #f5e2bf;
        cursor: pointer;
        padding: 10px 14px;
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif;
        font-weight: 600;
        transition: transform 0.2s ease, filter 0.2s ease;
    }

    .toggle-button:hover {
        transform: translateY(-1px);
        filter: brightness(1.1);
    }

    .stage-shell {
        position: relative;
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid rgba(232, 214, 185, 0.2);
        background: rgba(10, 12, 18, 0.6);
        width: min(100%, 1024px);
        height: min(76vh, 760px);
        transition: width 0.25s ease;
    }

    .stage-shell.mobile {
        width: min(100%, 540px);
    }

    @media (max-width: 760px) {
        .page {
            padding: 14px;
            align-items: stretch;
        }

        .panel {
            border-radius: 14px;
            padding: 12px;
        }

        .header {
            margin-bottom: 12px;
        }

        .stage-shell {
            height: min(72vh, 680px);
        }
    }
</style>
