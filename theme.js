// GitHubify: turns playlist and album headers into a GitHub repo header
// ("owner / name" + badge + a "Tracks" tab) and labels the search box.
// Only adds its own elements next to Spotify's; styling lives in user.css.

(function githubify() {
    if (!window.Spicetify?.Platform?.History || !document.body) {
        setTimeout(githubify, 300);
        return;
    }

    const SVG_NS = "http://www.w3.org/2000/svg";
    // Octicons (MIT): repo, play, people
    const ICONS = {
        people: "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z",
        repo: "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z",
        play: "M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5Z",
    };

    function icon(name) {
        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("gh-icon");
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", ICONS[name]);
        svg.append(path);
        return svg;
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    // Artist avatar and followers aren't in the page when Spotify shows a banner; ask the API once per artist.
    const artistInfo = new Map();
    const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

    function fetchArtist(uri) {
        if (!artistInfo.has(uri)) {
            artistInfo.set(uri, null);
            Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.queryArtistOverview, { uri, locale: "", includePrerelease: false })
                .then(({ data }) => {
                    const a = data.artistUnion;
                    const sources = a.visuals?.avatarImage?.sources ?? [];
                    // Smallest image that's still sharp at 96px on HiDPI
                    const avatar = sources.filter((s) => s.width >= 160).sort((x, y) => x.width - y.width)[0] ?? sources[0];
                    artistInfo.set(uri, { avatar: avatar?.url ?? "", followers: a.stats?.followers });
                    update();
                })
                .catch(() => {}); // ponytail: no avatar/followers on failure, the rest of the header still works
        }
        return artistInfo.get(uri);
    }

    // Artist page = GitHub profile: round avatar, name, "followers · monthly listeners"
    function buildArtist(header) {
        const id = Spicetify.Platform.History.location.pathname.match(/^\/artist\/([A-Za-z0-9]+)/)?.[1];
        const textBox = header.querySelector(".main-entityHeader-headerText");
        if (!id || !textBox) return;
        const info = fetchArtist(`spotify:artist:${id}`);
        if (!info) return;

        const listeners = textBox.textContent.match(/([\d.,]+\s*[KMB]?)\s+monthly listeners/i)?.[1] ?? "";
        const key = id + listeners;
        const existing = textBox.querySelector(":scope > .gh-followers");
        if (existing && existing.dataset.key === key) return;
        existing?.remove();
        header.querySelector(".gh-avatar")?.remove();

        // Artists without a banner already show their picture; only add one when it's missing.
        if (info.avatar && !header.querySelector(".main-entityHeader-imageContainer, .main-entityHeader-imageContainerNew")) {
            const img = el("img", "gh-avatar");
            img.src = info.avatar;
            img.alt = "";
            textBox.parentElement.before(img);
        }

        const line =el("div", "gh-followers");
        line.dataset.key = key;
        line.append(icon("people"));
        if (info.followers != null) line.append(el("strong", "", compact.format(info.followers)), " followers");
        if (info.followers != null && listeners) line.append(el("span", "gh-sep", "·"));
        if (listeners) line.append(el("strong", "", listeners), " monthly listeners");
        textBox.append(line);
    }

    function buildHeader(header) {
        if (header.closest('[data-testid="artist-page"]')) return buildArtist(header);

        const textBox = header.querySelector(".main-entityHeader-headerText");
        const titleEl = header.querySelector(".main-entityHeader-title h1");
        if (!textBox || !titleEl) return;

        const creator = header.querySelector(".main-entityHeader-creatorWrapper");
        const ownerLink = creator?.querySelector("a");
        // Spotify's label ("Public Playlist", "Album"...) is the first span, before the title.
        const labelEl = textBox.querySelector(":scope > span");
        const meta = header.querySelector(".main-entityHeader-metaData");

        const title = titleEl.textContent.trim();
        // "Made for teacup" playlists belong to Spotify, not to the listener.
        const madeFor = /^made for/i.test(creator?.textContent.trim() ?? "");
        const owner = madeFor ? "Spotify" : ownerLink?.textContent.trim() ?? "";
        const href = madeFor ? "" : ownerLink?.getAttribute("href") ?? "";
        const label = labelEl && !labelEl.contains(titleEl) ? labelEl.textContent.trim() : "";
        const count = meta?.textContent.match(/([\d,.]+)\s+(songs?|tracks?)/i)?.[1] ?? "";

        // Hide the "•" separators so the details read like GitHub's meta line.
        meta?.querySelectorAll("span").forEach((s) => {
            if (s.textContent.trim() === "•") s.setAttribute("data-gh-dot", "");
        });

        const key = [title, owner, href, label, count].join("|");
        const existing = textBox.querySelector(":scope > .gh-repo-head");
        if (existing && existing.dataset.key === key) return;
        existing?.remove();
        textBox.querySelector(":scope > .gh-tabs")?.remove();

        const head = el("div", "gh-repo-head");
        head.dataset.key = key;
        head.append(icon("repo"));
        if (owner) {
            if (href) {
                const a = el("a", "gh-owner", owner);
                a.href = href;
                a.addEventListener("click", (e) => {
                    e.preventDefault();
                    Spicetify.Platform.History.push(href);
                });
                head.append(a);
            } else {
                head.append(el("span", "gh-owner", owner));
            }
            head.append(el("span", "gh-slash", "/"));
        }
        head.append(el("strong", "gh-name", title));
        if (label) head.append(el("span", "gh-badge", label));
        textBox.prepend(head);

        if (count) {
            const tabs = el("div", "gh-tabs");
            const tab = el("span", "gh-tab gh-tab--active");
            tab.append(icon("play"), el("span", "", "Tracks"), el("span", "gh-count", count));
            tabs.append(tab);
            textBox.append(tabs);
        }
    }

    function labelSearch() {
        document.querySelectorAll(".main-actionBar-ActionBarRow .x-filterBox-filterInput").forEach((input) => {
            if (input.placeholder !== "Go to track…") input.placeholder = "Go to track…";
        });
    }

    // Your Library: "owner / name" rows, counts on the filter tabs, a "Find a playlist…" box.
    const LIBRARY_FILTERS = { Albums: "0", Artists: "1", Playlists: "2", Podcasts: "3" };
    const FIND_LABELS = { Playlists: "Find a playlist…", Albums: "Find an album…", Artists: "Find an artist…", Podcasts: "Find a podcast…" };
    let libraryCounts = {};
    let countsFetchedAt = 0;

    function fetchLibraryCounts() {
        // ponytail: refetched at most every 15s while the page changes; subscribe to LibraryAPI events if that lags
        if (Date.now() - countsFetchedAt < 15000) return;
        countsFetchedAt = Date.now();
        const api = Spicetify.Platform.LibraryAPI;
        Promise.all(Object.entries(LIBRARY_FILTERS).map(([label, id]) =>
            api.getContents({ limit: 1, offset: 0, filters: [id] }).then((r) => [label, r.totalLength])))
            .then((entries) => {
                libraryCounts = Object.fromEntries(entries);
                // The Playlists view lists Liked Songs, which the API doesn't count
                libraryCounts.Playlists += 1;
                update();
            })
            .catch(() => {});
    }

    function updateLibrary() {
        fetchLibraryCounts();

        let active = "";
        document.querySelectorAll(".main-yourLibraryX-filterArea [data-encore-id='chip']").forEach((chip) => {
            const label = chip.getAttribute("aria-label");
            const inner = chip.querySelector("[class*='chip__inner']");
            if (!inner) return;
            if (inner.className.includes("chip__inner--selected") && FIND_LABELS[label]) active = label;
            const n = libraryCounts[label];
            if (n != null && inner.dataset.ghCount !== String(n)) inner.dataset.ghCount = compact.format(n);
        });

        const find = document.querySelector(".main-yourLibraryX-libraryFilter .x-filterBox-filterInput");
        const placeholder = FIND_LABELS[active] ?? "Find in Your Library…";
        if (find && find.placeholder !== placeholder) find.placeholder = placeholder;

        // "Playlist • teacup" → owner "teacup"; "Made for teacup" mixes belong to Spotify, like the playlist header.
        // With a tab selected Spotify drops the type, leaving just "teacup" (but Artists keep "Artist").
        const ownerOnly = active && active !== "Artists";
        document.querySelectorAll(".main-yourLibraryX-libraryRootlist [data-encore-id='listRow']").forEach((row) => {
            const title = row.querySelector("[data-encore-id='listRowTitle']");
            const details = row.querySelector("[data-encore-id='listRowSubtitle'] > span:last-child");
            if (!title || !details) return;
            const parts = details.textContent.split("•").map((s) => s.trim());
            let owner = parts.length > 1 ? parts[1] : ownerOnly ? parts[0] : "";
            if (/^\d+ (playlists?|folders?)/i.test(owner)) owner = ""; // folders: "4 playlists"
            if (/^made for /i.test(owner)) owner = "Spotify";
            if (title.dataset.ghOwner !== owner) title.dataset.ghOwner = owner;
        });
    }

    let queued = false;
    function update() {
        queued = false;
        document.querySelectorAll(".main-entityHeader-container").forEach(buildHeader);
        labelSearch();
        updateLibrary();
        // Search result tags ("Song", "Artist"…): mark the type so CSS can colour Artist like a GitHub label
        document.querySelectorAll("[data-encore-id='tag']").forEach((tag) => {
            const type = tag.textContent.trim().toLowerCase();
            if (tag.dataset.ghTag !== type) tag.dataset.ghTag = type;
        });
    }

    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(update);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    update();
})();
