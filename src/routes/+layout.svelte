<svelte:head>
    <title>Phaser Chess</title>
</svelte:head>

<slot />

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        color: rgba(255, 255, 255, 0.9);
        background:
            radial-gradient(circle at 20% 20%, #193154 0%, transparent 42%),
            radial-gradient(circle at 80% 72%, #3a2311 0%, transparent 45%),
            #0d1524;
        font-family: 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif;
    }

    :global(*) {
        box-sizing: border-box;
    }
</style>
