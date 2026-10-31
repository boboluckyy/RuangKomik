(function () {
    const api = window.ruangKomik;
    if (!api?.ready) return;
    const playlists = [
        { key: 'lofi-reading', name: 'Lo-fi Reading' },
        { key: 'piano-relax', name: 'Piano & Relax' },
        { key: 'chill-vibes', name: 'Chill Vibes' }
    ];
    const settingsKey = 'ruang-komik-music-settings-v1';
    const readSettings = () => { try { return JSON.parse(localStorage.getItem(settingsKey) || '{}'); } catch (_) { return {}; } };
    const settings = readSettings();
    const root = document.createElement('aside');
    root.className = 'music-player';
    root.innerHTML = `<audio preload="none"></audio><button class="music-player-toggle" type="button" aria-expanded="false" aria-controls="music-player-panel"><span aria-hidden="true">♫</span><span class="music-player-toggle-label">Musik</span></button><section class="music-player-panel" id="music-player-panel" hidden aria-label="Pemutar musik"><header class="music-player-heading"><div><span class="music-player-kicker">RUANG KOMIK / MUSIC</span><h2>Temani bacamu</h2></div><button type="button" class="music-close" aria-label="Tutup pemutar">×</button></header><div class="music-now-playing"><img class="music-cover" alt="" hidden><div class="music-cover-fallback" aria-hidden="true">♫</div><div class="music-track-copy"><strong class="music-title">Pilih lagu</strong><span class="music-playlist-name">Lo-fi Reading</span></div></div><p class="music-message" role="status" aria-live="polite">Pilih lagu untuk mulai mendengarkan.</p><div class="music-timeline"><span data-current-time>0:00</span><input type="range" min="0" max="1000" value="0" aria-label="Posisi lagu"><span data-duration>0:00</span></div><div class="music-controls"><button type="button" data-action="shuffle" aria-label="Acak lagu" aria-pressed="false">⤨</button><button type="button" data-action="previous" aria-label="Lagu sebelumnya">⏮</button><button type="button" data-action="play" class="music-play" aria-label="Putar">▶</button><button type="button" data-action="next" aria-label="Lagu berikutnya">⏭</button><button type="button" data-action="repeat" aria-label="Ulangi lagu" aria-pressed="false">↻</button></div><label class="music-volume">Volume<input type="range" min="0" max="1" step="0.01" aria-label="Volume"></label><div class="music-library"><label for="music-playlist-select">Playlist</label><select id="music-playlist-select"></select><div class="music-track-list" role="list" aria-label="Daftar lagu"></div></div></section>`;
    document.body.append(root);
    const audio = root.querySelector('audio');
    const panel = root.querySelector('.music-player-panel');
    const toggle = root.querySelector('.music-player-toggle');
    const trackList = root.querySelector('.music-track-list');
    const playlistSelect = root.querySelector('#music-playlist-select');
    const message = root.querySelector('.music-message');
    const seek = root.querySelector('.music-timeline input');
    const volume = root.querySelector('.music-volume input');
    let tracks = [];
    let visibleTracks = [];
    let currentIndex = -1;
    let seeking = false;
    let shuffled = settings.shuffled === true;
    let repeat = settings.repeat === true;
    const escape = api.escape;
    const url = path => path ? (String(path).startsWith('http') ? path : api.client.storage.from('music-files').getPublicUrl(path).data.publicUrl) : '';
    function save() {
        try { localStorage.setItem(settingsKey, JSON.stringify({ volume: audio.volume, shuffled, repeat, playlist: playlistSelect.value, trackId: visibleTracks[currentIndex]?.id || null, time: audio.currentTime || 0 })); } catch (_) { /* Preferences are optional. */ }
    }
    function formatTime(seconds) { return Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00'; }
    function setMessage(text, error = false) { message.textContent = text; message.dataset.error = String(error); }
    function renderTracks() {
        visibleTracks = tracks.filter(track => track.playlist_key === playlistSelect.value);
        trackList.innerHTML = visibleTracks.length ? visibleTracks.map((track, index) => `<button class="music-track-option${visibleTracks[currentIndex]?.id === track.id ? ' is-current' : ''}" type="button" data-track-index="${index}"><span class="music-track-number">${String(index + 1).padStart(2, '0')}</span><span><strong>${escape(track.title)}</strong><small>${escape(track.artist || 'Ruang Komik')}</small></span><span class="music-track-play" aria-hidden="true">▶</span></button>`).join('') : '<p class="music-empty">Belum ada lagu di playlist ini.</p>';
    }
    function selectTrack(index, shouldPlay) {
        if (!visibleTracks.length) return;
        currentIndex = (index + visibleTracks.length) % visibleTracks.length;
        const track = visibleTracks[currentIndex];
        audio.src = url(track.audio_path);
        audio.load();
        root.querySelector('.music-title').textContent = track.title;
        root.querySelector('.music-playlist-name').textContent = `${playlists.find(item => item.key === track.playlist_key)?.name || 'Playlist'} · ${track.artist || 'Ruang Komik'}`;
        const cover = root.querySelector('.music-cover');
        const coverUrl = url(track.cover_path);
        cover.hidden = !coverUrl;
        cover.src = coverUrl;
        root.querySelector('.music-cover-fallback').hidden = Boolean(coverUrl);
        renderTracks();
        setMessage(shouldPlay ? 'Memuat lagu…' : 'Siap diputar.');
        save();
        if (shouldPlay) audio.play().catch(() => setMessage('Lagu tidak dapat diputar. Periksa file audio atau coba lagi.', true));
    }
    function next(direction) {
        if (!visibleTracks.length) return;
        let target = currentIndex < 0 ? 0 : currentIndex + direction;
        if (shuffled && direction > 0 && visibleTracks.length > 1) {
            do { target = Math.floor(Math.random() * visibleTracks.length); } while (target === currentIndex);
        }
        selectTrack(target, true);
    }
    playlists.forEach(item => playlistSelect.add(new Option(item.name, item.key)));
    playlistSelect.value = playlists.some(item => item.key === settings.playlist) ? settings.playlist : playlists[0].key;
    audio.volume = Number.isFinite(Number(settings.volume)) ? Math.min(1, Math.max(0, Number(settings.volume))) : 0.7;
    volume.value = audio.volume;
    root.querySelector('[data-action="shuffle"]').setAttribute('aria-pressed', String(shuffled));
    root.querySelector('[data-action="repeat"]').setAttribute('aria-pressed', String(repeat));
    renderTracks();
    toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; toggle.setAttribute('aria-expanded', String(!panel.hidden)); });
    root.querySelector('.music-close').addEventListener('click', () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); });
    playlistSelect.addEventListener('change', () => { currentIndex = -1; audio.pause(); audio.removeAttribute('src'); audio.load(); renderTracks(); save(); });
    trackList.addEventListener('click', event => { const button = event.target.closest('[data-track-index]'); if (button) selectTrack(Number(button.dataset.trackIndex), true); });
    root.querySelector('.music-controls').addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        if (action === 'play') {
            if (!audio.src && visibleTracks.length) selectTrack(0, true);
            else if (audio.paused) audio.play().catch(() => setMessage('Lagu tidak dapat diputar. Periksa file audio atau coba lagi.', true));
            else audio.pause();
        }
        if (action === 'next') next(1);
        if (action === 'previous') next(-1);
        if (action === 'shuffle') { shuffled = !shuffled; event.target.closest('button').setAttribute('aria-pressed', String(shuffled)); save(); }
        if (action === 'repeat') { repeat = !repeat; event.target.closest('button').setAttribute('aria-pressed', String(repeat)); save(); }
    });
    volume.addEventListener('input', () => { audio.volume = Number(volume.value); save(); });
    seek.addEventListener('pointerdown', () => { seeking = true; });
    seek.addEventListener('pointerup', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 1000 * audio.duration; seeking = false; save(); });
    seek.addEventListener('change', () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 1000 * audio.duration; seeking = false; save(); });
    seek.addEventListener('input', () => { if (seeking && Number.isFinite(audio.duration)) root.querySelector('[data-current-time]').textContent = formatTime(Number(seek.value) / 1000 * audio.duration); });
    audio.addEventListener('timeupdate', () => { if (!seeking && Number.isFinite(audio.duration)) seek.value = String(audio.currentTime / audio.duration * 1000); root.querySelector('[data-current-time]').textContent = formatTime(audio.currentTime); if (Math.floor(audio.currentTime) % 5 === 0) save(); });
    audio.addEventListener('loadedmetadata', () => { root.querySelector('[data-duration]').textContent = formatTime(audio.duration); });
    audio.addEventListener('play', () => { root.querySelector('[data-action="play"]').textContent = 'Ⅱ'; root.querySelector('[data-action="play"]').setAttribute('aria-label', 'Jeda'); setMessage('Sedang diputar.'); });
    audio.addEventListener('pause', () => { root.querySelector('[data-action="play"]').textContent = '▶'; root.querySelector('[data-action="play"]').setAttribute('aria-label', 'Putar'); });
    audio.addEventListener('ended', () => repeat ? (audio.currentTime = 0, audio.play()) : next(1));
    audio.addEventListener('error', () => { if (audio.src) setMessage('File audio gagal dimuat. Admin dapat mengganti file lagu.', true); });
    window.addEventListener('pagehide', save);
    (async () => {
        const { data, error } = await api.client.from('music_tracks').select('id,title,artist,playlist_key,audio_path,cover_path').order('created_at').order('id');
        if (error) { setMessage('Daftar lagu belum tersedia.'); return; }
        tracks = data || [];
        renderTracks();
        const saved = tracks.find(track => track.id === settings.trackId && track.playlist_key === playlistSelect.value);
        if (saved) {
            currentIndex = visibleTracks.findIndex(track => track.id === saved.id);
            selectTrack(currentIndex, false);
            if (Number.isFinite(Number(settings.time)) && Number(settings.time) > 0) {
                audio.addEventListener('loadedmetadata', () => { audio.currentTime = Math.min(Number(settings.time), Math.max(0, audio.duration - 1)); }, { once: true });
            }
            setMessage('Posisi terakhir dipulihkan. Tekan putar untuk melanjutkan.');
        } else if (!tracks.length) setMessage('Playlist akan tampil di sini setelah Admin menambahkan lagu.');
    })();
}());
