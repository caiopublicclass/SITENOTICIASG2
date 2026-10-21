(() => {
    const formBusca = document.getElementById("formBusca");
    const busca = document.getElementById("busca");
    const categoria = document.getElementById("categoria");
    const cards = [...document.querySelectorAll(".news-card")];
    const secoes = [...document.querySelectorAll(".news-section")];
    const mensagem = document.getElementById("mensagem");
    const mensagemTexto = document.getElementById("mensagem-texto");
    const resultadosContagem = document.getElementById("results-count");
    const limparFiltros = document.getElementById("limpar-filtros");
    const mostrarTodas = document.getElementById("mostrar-todas");
    const actionToast = document.getElementById("action-toast");
    const toastMessage = document.getElementById("action-toast-message");
    const shareFallback = document.getElementById("share-fallback");
    const shareUrl = document.getElementById("share-url");
    const selectShareUrl = document.getElementById("select-share-url");
    const closeToast = document.getElementById("action-toast-close");
    const favoritosToggle = document.getElementById("favoritos-toggle");
    const favoritosCount = document.getElementById("favoritos-count");
    const statusInteracao = document.getElementById("status-interacao");
    const voltarTopo = document.getElementById("voltar-topo");
    const menuToggle = document.getElementById("menu-toggle");
    const menuEditorias = document.getElementById("menu-editorias");
    const linksNavegacao = [...document.querySelectorAll(".nav-links a")];
    const storageKey = "g2-noticias-favoritas";
    const idsPresentes = new Set();
    let mostrarSomenteSalvas = false;
    let favoritos = new Set();
    let painelAberto = null;
    let timerToast;
    let focoAntesDelAviso = null;

    try {
        const salvos = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(salvos)) favoritos = new Set(salvos
            .filter(item => typeof item === "string")
            .map(id => id === "brasil-estudantes-une" ? "justica-pm-zona-leste-sp" : id));
    } catch {
        // A página continua utilizável quando o navegador bloqueia armazenamento local.
    }

    function anunciar(texto) {
        statusInteracao.textContent = texto;
    }

    function mostrarAviso(texto, url = "") {
        window.clearTimeout(timerToast);
        if (actionToast.hidden) focoAntesDelAviso = document.activeElement;
        toastMessage.textContent = texto;
        shareFallback.hidden = !url;
        if (url) shareUrl.value = url;
        actionToast.hidden = false;
        anunciar(texto);
        if (!url) timerToast = window.setTimeout(() => {
            if (!actionToast.contains(document.activeElement)) actionToast.hidden = true;
        }, 6000);
    }

    function normalizar(texto) {
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
    }

    function salvarFavoritos() {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify([...favoritos]));
            return true;
        } catch {
            mostrarAviso("O navegador não permitiu salvar entre visitas; a seleção ficará nesta sessão.");
            return false;
        }
    }

    cards.forEach(card => {
        if (!card.dataset.newsId) {
            const slug = normalizar(card.querySelector("h3").textContent).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            card.dataset.newsId = `${normalizar(card.dataset.categoria).replace(/[^a-z0-9]+/g, "-")}-${slug}`;
        }
        card.id = card.dataset.newsId;
        idsPresentes.add(card.dataset.newsId);

        const titulo = card.querySelector("h3").textContent.trim();
        const ferramentas = document.createElement("div");
        ferramentas.className = "card-tools";

        const salvar = document.createElement("button");
        salvar.type = "button";
        salvar.className = "card-tool";
        salvar.dataset.action = "favorite";
        salvar.addEventListener("click", () => alternarFavorito(card));

        const compartilhar = document.createElement("button");
        compartilhar.type = "button";
        compartilhar.className = "card-tool";
        compartilhar.textContent = "Compartilhar ↗";
        compartilhar.setAttribute("aria-label", `Compartilhar: ${titulo}`);
        compartilhar.addEventListener("click", () => compartilharNoticia(card));

        const verResumo = document.createElement("button");
        verResumo.type = "button";
        verResumo.className = "card-tool";
        verResumo.textContent = "Resumo";
        verResumo.setAttribute("aria-label", `Ver resumo: ${titulo}`);
        verResumo.addEventListener("click", () => abrirResumo(card, verResumo));

        const resumoNoLinkPrincipal = Boolean(card.querySelector('.botao[href^="#"]'));
        ferramentas.append(salvar, ...(resumoNoLinkPrincipal ? [] : [verResumo]), compartilhar);
        card.querySelector(".conteudo").appendChild(ferramentas);

        const imagem = card.querySelector("img");
        if (imagem) {
            imagem.addEventListener("error", () => {
                const alternativa = document.createElement("div");
                alternativa.className = "image-fallback";
                alternativa.setAttribute("role", "img");
                alternativa.setAttribute("aria-label", imagem.alt || "Imagem indisponível");
                alternativa.textContent = "Imagem indisponível";
                imagem.replaceWith(alternativa);
            }, { once: true });
        }
    });

    favoritos = new Set([...favoritos].filter(id => idsPresentes.has(id)));
    salvarFavoritos();

    function atualizarControlesFavorito() {
        favoritosCount.textContent = String(favoritos.size);
        cards.forEach(card => {
            const botao = card.querySelector('[data-action="favorite"]');
            if (!botao) return;
            const salvo = favoritos.has(card.dataset.newsId);
            botao.setAttribute("aria-pressed", String(salvo));
            botao.textContent = salvo ? "Salva ♥" : "Salvar ♡";
            botao.setAttribute("aria-label", `${salvo ? "Remover das salvas" : "Salvar"}: ${card.querySelector("h3").textContent.trim()}`);
        });
    }

    function alternarFavorito(card) {
        const id = card.dataset.newsId;
        const removendo = favoritos.has(id);
        if (removendo) {
            favoritos.delete(id);
        } else {
            favoritos.add(id);
        }
        const persistido = salvarFavoritos();
        atualizarControlesFavorito();
        filtrarNoticias();
        if (removendo && mostrarSomenteSalvas) favoritosToggle.focus();
        mostrarAviso(persistido
            ? (removendo ? "Notícia removida das salvas." : "Notícia salva neste navegador.")
            : "A notícia ficou salva apenas nesta sessão.");
    }

    async function compartilharNoticia(card) {
        const titulo = card.querySelector("h3").textContent.trim();
        const linkFonte = [...card.querySelectorAll("a[href]")].find(link => /^https:\/\//i.test(link.href));
        const url = linkFonte?.href || new URL(`#${card.id}`, window.location.href).href;

        try {
            if (typeof navigator.share === "function") {
                await navigator.share({ title: titulo, url });
                mostrarAviso("Link compartilhado.");
            } else if (typeof navigator.clipboard?.writeText === "function") {
                await navigator.clipboard.writeText(url);
                mostrarAviso("Link copiado para a área de transferência.");
            } else {
                mostrarAviso("Não foi possível copiar automaticamente. Selecione e copie o link abaixo.", url);
            }
        } catch (erro) {
            if (erro?.name === "AbortError") return;
            mostrarAviso("Não foi possível compartilhar automaticamente. Selecione e copie o link abaixo.", url);
        }
    }

    function fecharResumo({ restaurarFoco = true } = {}) {
        if (!painelAberto) return;
        const { painel, acionador } = painelAberto;
        painel.remove();
        acionador.setAttribute("aria-expanded", "false");
        acionador.removeAttribute("aria-controls");
        painelAberto = null;
        if (restaurarFoco && acionador.isConnected && !acionador.closest(".news-card").hidden) acionador.focus();
    }

    function abrirResumo(card, acionador) {
        const grade = card.closest(".news-grid");
        if (!grade) return;
        fecharResumo({ restaurarFoco: false });

        const painel = document.createElement("aside");
        painel.className = "news-detail-lateral";
        painel.id = `${card.dataset.newsId}-resumo`;
        painel.setAttribute("role", "region");
        painel.setAttribute("aria-labelledby", `${card.dataset.newsId}-resumo-titulo`);

        const fechar = document.createElement("button");
        fechar.className = "fechar-resumo";
        fechar.type = "button";
        fechar.textContent = "Fechar resumo";
        fechar.addEventListener("click", () => fecharResumo());

        const categoriaCard = card.dataset.categoria;
        const etiqueta = document.createElement("span");
        etiqueta.className = "categoria";
        etiqueta.textContent = card.querySelector(".categoria")?.textContent.trim() || categoriaCard;

        const titulo = document.createElement("h3");
        titulo.id = `${card.dataset.newsId}-resumo-titulo`;
        titulo.textContent = card.querySelector("h3").textContent.trim();

        const texto = document.createElement("p");
        const paragrafo = card.querySelector(".conteudo > p:not(.news-meta)");
        texto.textContent = paragrafo?.textContent.trim() || "Consulte o cartão para ver os detalhes disponíveis.";

        painel.append(fechar, etiqueta, titulo, texto);
        const linkFonte = [...card.querySelectorAll(".conteudo > a[href]")].find(link => /^https:\/\//i.test(link.href));
        if (linkFonte) {
            const fonte = document.createElement("p");
            fonte.className = "fonte";
            fonte.textContent = `Fonte: ${etiqueta.textContent}`;
            const link = document.createElement("a");
            link.href = linkFonte.href;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Ler na fonte original ↗";
            painel.append(fonte, link);
        } else {
            const nota = document.createElement("p");
            nota.className = "fonte";
            nota.textContent = "Conteúdo demonstrativo; o cartão não indica uma fonte original.";
            painel.append(nota);
        }

        grade.appendChild(painel);
        painelAberto = { painel, grade, card, acionador };
        acionador.setAttribute("aria-expanded", "true");
        acionador.setAttribute("aria-controls", painel.id);
        anunciar(`Resumo aberto: ${titulo.textContent}`);
        fechar.focus();
    }

    document.querySelectorAll(".news-card .botao[href^='#']").forEach(botao => {
        botao.addEventListener("click", event => {
            event.preventDefault();
            abrirResumo(botao.closest(".news-card"), botao);
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (painelAberto) {
                fecharResumo();
            } else if (menuToggle.getAttribute("aria-expanded") === "true") {
                fecharMenu(true);
            }
        }
    });

    function filtrarNoticias() {
        const texto = normalizar(busca.value);
        const categoriaSelecionada = categoria.value;
        let encontradas = 0;

        cards.forEach(card => {
            const termos = [
                card.querySelector("h3").textContent,
                ...[...card.querySelectorAll(".conteudo p, .categoria")].map(item => item.textContent),
                card.dataset.categoria
            ].map(normalizar);
            const correspondeTexto = !texto || termos.some(termo => termo.includes(texto));
            const correspondeCategoria = categoriaSelecionada === "Todas" || card.dataset.categoria === categoriaSelecionada;
            const correspondeFavoritos = !mostrarSomenteSalvas || favoritos.has(card.dataset.newsId);
            card.hidden = !(correspondeTexto && correspondeCategoria && correspondeFavoritos);
            if (!card.hidden) encontradas++;
        });

        if (painelAberto && painelAberto.card.hidden) fecharResumo({ restaurarFoco: false });

        secoes.forEach(secao => {
            secao.hidden = ![...secao.querySelectorAll(".news-card")].some(card => !card.hidden);
        });

        resultadosContagem.textContent = encontradas === 1 ? "1 notícia encontrada" : `${encontradas} notícias encontradas`;
        mensagem.hidden = encontradas > 0;
        limparFiltros.hidden = true;
        mostrarTodas.hidden = true;
        if (!encontradas) {
            if (mostrarSomenteSalvas && favoritos.size === 0) {
                mensagemTexto.textContent = "Você ainda não salvou notícias. Salve uma notícia para encontrá-la aqui.";
                mostrarTodas.hidden = false;
            } else if (mostrarSomenteSalvas) {
                mensagemTexto.textContent = "Nenhuma notícia salva corresponde aos filtros atuais.";
                limparFiltros.hidden = false;
            } else if (texto) {
                mensagemTexto.textContent = "Nenhuma notícia corresponde à sua busca e aos filtros atuais.";
                limparFiltros.hidden = false;
            } else {
                mensagemTexto.textContent = "Nenhuma notícia corresponde à categoria selecionada.";
                limparFiltros.hidden = false;
            }
        }
        anunciar(encontradas === 1 ? "1 notícia encontrada." : `${encontradas} notícias encontradas.`);
    }

    function fecharMenu(restaurarFoco = false) {
        menuToggle.setAttribute("aria-expanded", "false");
        menuEditorias.classList.remove("is-open");
        if (restaurarFoco) menuToggle.focus();
    }

    menuToggle.addEventListener("click", () => {
        const aberto = menuToggle.getAttribute("aria-expanded") !== "true";
        menuToggle.setAttribute("aria-expanded", String(aberto));
        menuEditorias.classList.toggle("is-open", aberto);
    });

    linksNavegacao.forEach(link => {
        link.addEventListener("click", () => {
            definirNavegacaoAtiva(link);
            fecharMenu(window.matchMedia("(max-width: 600px)").matches);
        });
    });

    function definirNavegacaoAtiva(linkAtivo) {
        linksNavegacao.forEach(link => {
            const ativo = link === linkAtivo;
            link.classList.toggle("active", ativo);
            if (ativo) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
        });
    }

    if ("IntersectionObserver" in window) {
        const observador = new IntersectionObserver(entradas => {
            const visiveis = entradas.filter(entrada => entrada.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            if (!visiveis.length) return;
            const link = linksNavegacao.find(item => item.hash === `#${visiveis[0].target.id}`);
            if (link) definirNavegacaoAtiva(link);
        }, { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.2, 0.5] });
        linksNavegacao.forEach(link => {
            const secao = document.querySelector(link.getAttribute("href"));
            if (secao) observador.observe(secao);
        });
    }

    formBusca.addEventListener("submit", event => {
        event.preventDefault();
        filtrarNoticias();
    });
    busca.addEventListener("input", filtrarNoticias);
    categoria.addEventListener("change", filtrarNoticias);
    favoritosToggle.addEventListener("click", () => {
        mostrarSomenteSalvas = !mostrarSomenteSalvas;
        favoritosToggle.setAttribute("aria-pressed", String(mostrarSomenteSalvas));
        filtrarNoticias();
        anunciar(mostrarSomenteSalvas ? "Mostrando notícias salvas." : "Mostrando todas as notícias.");
    });

    limparFiltros.addEventListener("click", () => {
        busca.value = "";
        categoria.value = "Todas";
        filtrarNoticias();
        busca.focus();
    });
    mostrarTodas.addEventListener("click", () => {
        mostrarSomenteSalvas = false;
        favoritosToggle.setAttribute("aria-pressed", "false");
        busca.value = "";
        categoria.value = "Todas";
        filtrarNoticias();
        favoritosToggle.focus();
    });
    selectShareUrl.addEventListener("click", () => {
        shareUrl.focus();
        shareUrl.select();
        anunciar("Link selecionado. Use copiar para guardá-lo.");
    });
    closeToast.addEventListener("click", () => {
        window.clearTimeout(timerToast);
        actionToast.hidden = true;
        if (focoAntesDelAviso?.isConnected) focoAntesDelAviso.focus();
    });

    function atualizarBotaoTopo() {
        voltarTopo.hidden = window.scrollY < 480;
    }
    window.addEventListener("scroll", atualizarBotaoTopo, { passive: true });
    atualizarBotaoTopo();
    voltarTopo.addEventListener("click", () => {
        const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: movimentoReduzido ? "auto" : "smooth" });
    });

    atualizarControlesFavorito();
    filtrarNoticias();
})();
