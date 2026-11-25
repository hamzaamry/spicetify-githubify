// GitHubify: turns playlist and album headers into a GitHub repo header
// ("owner / name" + badge + a "Tracks" tab) and labels the search box.
// Only adds its own elements next to Spotify's; styling lives in user.css.

(function githubify() {
    if (!window.Spicetify?.Platform?.History || !document.body) {
        setTimeout(githubify, 300);
        return;
    }

    const SVG_NS = "http://www.w3.org/2000/svg";
    // Octicons (MIT): repo, play
    const ICONS = {
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

    function buildHeader(header) {
        // Artist pages use a big background image header; leave them alone.
        if (header.classList.contains("main-entityHeader-withBackgroundImage")) return;

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

    let queued = false;
    function update() {
        queued = false;
        document.querySelectorAll(".main-entityHeader-container").forEach(buildHeader);
        labelSearch();
    }

    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(update);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    update();
})();
