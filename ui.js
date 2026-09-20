// ============================================================
// ui.js — interaksi & animasi ringan
// ============================================================
(function () {
    'use strict';

    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    // ------------------------------------------------------------
    // GREETING
    // ------------------------------------------------------------
    const heroGreeting = document.getElementById('heroGreeting');
    if (heroGreeting) {
        const hour = new Date().getHours();
        let greeting = 'Selamat datang,';
        if (hour >= 4 && hour < 11) greeting = 'Selamat pagi,';
        else if (hour >= 11 && hour < 15) greeting = 'Selamat siang,';
        else if (hour >= 15 && hour < 18) greeting = 'Selamat sore,';
        else greeting = 'Selamat malam,';
        heroGreeting.textContent = greeting;
    }

    // ------------------------------------------------------------
    // MOBILE VIEW STATE
    // ------------------------------------------------------------
    function setView(view) {
        if (!isMobile()) {
            document.body.removeAttribute('data-view');
            return;
        }
        document.body.dataset.view = view;
    }
    if (isMobile()) setView('home');
    else document.body.removeAttribute('data-view');

    // ------------------------------------------------------------
    // COUNT-UP STATS
    // ------------------------------------------------------------
    function animateCountUp(el, target, duration = 900) {
        if (!el || isNaN(target)) return;
        const start = performance.now();
        function frame(now) {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased);
            if (t < 1) requestAnimationFrame(frame);
            else el.textContent = target;
        }
        requestAnimationFrame(frame);
    }

    const statPairs = [
        ['statPertemuan', 'statPertemuanDesktop'],
        ['statJam', 'statJamDesktop'],
        ['statSudah', 'statSudahDesktop'],
        ['statBelum', 'statBelumDesktop']
    ];
    const seen = new Set();

    function tryAnimate() {
        statPairs.forEach(([mobileId, desktopId]) => {
            [mobileId, desktopId].forEach(id => {
                const el = document.getElementById(id);
                if (!el || seen.has(id)) return;
                const raw = el.textContent.trim();
                const num = parseFloat(raw.replace(/[^0-9.-]/g, ''));
                if (!isNaN(num) && raw !== '—' && raw !== '-') {
                    seen.add(id);
                    animateCountUp(el, num, 900);
                }
            });
        });

        const belum = document.getElementById('statBelum');
        const heroStatus = document.getElementById('heroStatus');
        if (belum && heroStatus && belum.textContent.trim() !== '—') {
            const n = belum.textContent.trim();
            if (n === '0') heroStatus.innerHTML = 'Semua sesi sudah terverifikasi.';
            else heroStatus.innerHTML = `<strong>${n}</strong> sesi menunggu verifikasi.`;
        }
    }

    const statsGrid = document.getElementById('statsGrid');
    const statsGridDesktop = document.getElementById('statsGridDesktop');
    [statsGrid, statsGridDesktop].forEach(grid => {
        if (!grid) return;
        const obs = new MutationObserver(tryAnimate);
        obs.observe(grid, { subtree: true, childList: true, characterData: true });
    });

    // ------------------------------------------------------------
    // STAGGER ROWS
    // ------------------------------------------------------------
    function applyStagger(container) {
        if (!container || container.dataset.staggered) return;
        const rows = container.querySelectorAll('.data-row');
        rows.forEach((row, i) => {
            if (i > 20) return;
            row.style.opacity = '0';
            row.style.transform = 'translateY(6px)';
            row.style.transition = `opacity 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 25}ms, transform 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 25}ms`;
            requestAnimationFrame(() => {
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            });
        });
        container.dataset.staggered = '1';
    }

    ['tableSemua', 'tableReguler', 'tableClub', 'rekapList', 'salaryList'].forEach(id => {
        const tbody = document.getElementById(id);
        if (!tbody) return;
        const obs = new MutationObserver(() => {
            if (tbody.querySelectorAll('.data-row').length > 0) {
                applyStagger(tbody);
                obs.disconnect();
            }
        });
        obs.observe(tbody, { childList: true });
    });

    // ------------------------------------------------------------
    // BOTTOM NAV
    // ------------------------------------------------------------
    const bottomNav = document.getElementById('bottomNav');
    const navBtns = bottomNav ? bottomNav.querySelectorAll('.bn-btn') : [];

    function activateNav(key) {
        navBtns.forEach(b => b.classList.toggle('active', b.dataset.nav === key));
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const nav = btn.dataset.nav;

            if (nav === 'home') {
                setView('home');
                activateNav('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            const desktopTab = document.querySelector(`.tab[data-tab="${nav}"]`);
            if (desktopTab) desktopTab.click();

            setView('tab');
            activateNav(nav);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // ------------------------------------------------------------
    // QUICK ACCESS (mobile home)
    // ------------------------------------------------------------
    document.querySelectorAll('.mh-quick-card[data-nav]').forEach(card => {
        card.addEventListener('click', e => {
            e.preventDefault();
            const nav = card.dataset.nav;
            const desktopTab = document.querySelector(`.tab[data-tab="${nav}"]`);
            if (desktopTab) desktopTab.click();
            setView('tab');
            activateNav(nav);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // ------------------------------------------------------------
    // RESIZE
    // ------------------------------------------------------------
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!isMobile()) {
                document.body.removeAttribute('data-view');
            } else if (!document.body.dataset.view) {
                setView('home');
            }
        }, 200);
    });

    // ------------------------------------------------------------
    // HASH ROUTING (dari quick access)
    // ------------------------------------------------------------
    if (location.hash) {
        const nav = location.hash.replace('#', '');
        if (['reguler', 'club', 'rekap', 'salary'].includes(nav)) {
            setTimeout(() => {
                const desktopTab = document.querySelector(`.tab[data-tab="${nav}"]`);
                if (desktopTab) desktopTab.click();
                setView('tab');
                activateNav(nav);
            }, 100);
        }
    }

})();