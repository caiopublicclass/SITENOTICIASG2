const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.route("https://images.unsplash.com/**", route => route.abort());
    await page.goto("/Index.html");
});

test("menu de editorias é operável por teclado e tem estado acessível", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole("button", { name: "Editorias" });
    await menu.focus();
    await menu.press("Enter");
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Brasil" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();
    await menu.press("Enter");
    await page.getByRole("navigation").getByRole("link", { name: "Brasil" }).click();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("busca ignora acentos e filtro por categoria restringe os cartões", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Buscar notícias" }).fill("ciencia");
    await expect(page.locator('[data-news-id="ciencia-guia-descobertas"]')).toBeVisible();
    await expect(page.locator("#results-count")).toHaveText("1 notícia encontrada");
    await page.getByRole("searchbox", { name: "Buscar notícias" }).fill("termo inexistente");
    await expect(page.locator("#mensagem-texto")).toContainText("Nenhuma notícia corresponde");
    await expect(page.getByRole("button", { name: "Limpar busca e categoria" })).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca e categoria" }).click();
    await expect(page.getByRole("searchbox", { name: "Buscar notícias" })).toBeFocused();
    await page.getByRole("searchbox", { name: "Buscar notícias" }).fill("");
    await page.getByLabel("Filtrar por categoria").selectOption("Guia de Compras");
    await expect(page.locator(".news-card:visible")).toHaveCount(3);
});

test("resumo usa os dados do cartão, fecha por Escape e restaura o foco", async ({ page }) => {
    const abrir = page.locator("#guia-casa .botao");
    await abrir.click();
    const painel = page.locator(".news-detail-lateral");
    await expect(painel.getByRole("heading", { name: "Casa" })).toBeVisible();
    await expect(painel).toContainText("Guias de produtos para casa e organização.");
    await expect(painel).toContainText("Conteúdo demonstrativo");
    await expect(abrir).toHaveAttribute("aria-expanded", "true");
    await expect(abrir).toHaveAttribute("aria-controls", "guia-casa-resumo");
    await page.keyboard.press("Escape");
    await expect(painel).toHaveCount(0);
    await expect(abrir).toHaveAttribute("aria-expanded", "false");
    await expect(abrir).not.toHaveAttribute("aria-controls");
    await expect(abrir).toBeFocused();
});

test("filtrar outros cartões mantém aberto o resumo do cartão correspondente", async ({ page }) => {
    await page.locator("#guia-casa .botao").click();
    await page.getByRole("searchbox", { name: "Buscar notícias" }).fill("Casa");
    await expect(page.locator("#guia-casa")).toBeVisible();
    await expect(page.locator(".news-detail-lateral")).toBeVisible();
    await expect(page.locator("#guia-celulares")).toBeHidden();
});

test("favoritas persistem, filtram e descartam IDs obsoletos", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("g2-noticias-favoritas", JSON.stringify(["id-antigo"])));
    await page.reload();
    const cartao = page.locator('[data-news-id="justica-pm-zona-leste-sp"]');
    await cartao.getByRole("button", { name: /Salvar:/ }).click();
    await page.reload();
    await page.getByRole("button", { name: /Salvas/ }).click();
    await expect(cartao).toBeVisible();
    await expect(cartao.getByRole("button", { name: /Remover das salvas/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#favoritos-count")).toHaveText("1");
    await expect(page.locator("#action-toast-message")).toHaveText("Notícia salva neste navegador.");
});

test("estado vazio de salvas oferece recuperação para voltar às notícias", async ({ page }) => {
    await page.getByRole("button", { name: /Salvas/ }).click();
    await expect(page.locator("#mensagem-texto")).toContainText("Você ainda não salvou notícias");
    await page.getByRole("button", { name: "Mostrar todas as notícias" }).click();
    await expect(page.locator(".news-card:visible")).toHaveCount(12);
    await expect(page.getByRole("button", { name: /Salvas/ })).toBeFocused();
});

test("ID anterior da curadoria migra para o identificador coerente", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("g2-noticias-favoritas", JSON.stringify(["brasil-estudantes-une"])));
    await page.reload();
    const card = page.locator('[data-news-id="justica-pm-zona-leste-sp"]');
    await expect(card.getByRole("button", { name: /Remover das salvas/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#favoritos-count")).toHaveText("1");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("g2-noticias-favoritas"))).includes("justica-pm-zona-leste-sp")).toBe(true);
});

test("cartões demonstrativos oferecem uma única ação de resumo", async ({ page }) => {
    const demo = page.locator('[data-news-id="brasil-estudantes-demo"]');
    await expect(demo.getByRole("link", { name: "Ver resumo" })).toBeVisible();
    await expect(demo.locator(".card-tools button")).toHaveCount(2);
    const curated = page.locator('[data-news-id="justica-pm-zona-leste-sp"]');
    await expect(curated.getByRole("button", { name: /Ver resumo:/ })).toBeVisible();
});

test("falha no armazenamento não impede salvar na sessão atual", async ({ page }) => {
    await page.addInitScript(() => {
        Storage.prototype.setItem = function () { throw new DOMException("bloqueado", "SecurityError"); };
    });
    await page.reload();
    const cartao = page.locator('[data-news-id="justica-pm-zona-leste-sp"]');
    await cartao.getByRole("button", { name: /Salvar:/ }).click();
    await expect(cartao.getByRole("button", { name: /Remover das salvas/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#status-interacao")).toContainText("apenas nesta sessão");
});

test("compartilhamento usa Web Share e trata cancelamento", async ({ page }) => {
    await page.addInitScript(() => {
        window.__shareCalls = [];
        Object.defineProperty(navigator, "share", { configurable: true, value: async data => { window.__shareCalls.push(data); } });
    });
    await page.reload();
    const card = page.locator('[data-news-id="justica-pm-zona-leste-sp"]');
    await card.getByRole("button", { name: /Compartilhar:/ }).click();
    await expect.poll(() => page.evaluate(() => window.__shareCalls.length)).toBe(1);
    await expect(page.locator("#status-interacao")).toHaveText("Link compartilhado.");
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("cancelado", "AbortError"); } });
    });
    await page.reload();
    await page.locator('[data-news-id="justica-pm-zona-leste-sp"]').getByRole("button", { name: /Compartilhar:/ }).click();
    await expect(page.locator("#status-interacao")).not.toHaveText("Não foi possível compartilhar este link.");
});

test("fallback de compartilhamento copia o link quando Web Share não existe", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
        window.__copied = "";
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: async value => { window.__copied = value; } }
        });
    });
    await page.reload();
    await page.locator('[data-news-id="justica-pm-zona-leste-sp"]')
        .getByRole("button", { name: /Compartilhar:/ }).click();
    await expect.poll(() => page.evaluate(() => window.__copied)).toContain("agenciabrasil.ebc.com.br");
    await expect(page.locator("#status-interacao")).toHaveText("Link copiado para a área de transferência.");
});

test("fallback de compartilhamento permite selecionar o link sem APIs disponíveis", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    });
    await page.reload();
    await page.locator('[data-news-id="justica-pm-zona-leste-sp"]')
        .getByRole("button", { name: /Compartilhar:/ }).click();
    await expect(page.locator("#share-fallback")).toBeVisible();
    await expect(page.locator("#share-url")).toHaveValue(/agenciabrasil\.ebc\.com\.br/);
    await page.getByRole("button", { name: "Selecionar link" }).click();
    await expect(page.locator("#share-url")).toBeFocused();
});

test("links internos de resumo não abrem aba e links de fonte externa são protegidos", async ({ page }) => {
    await page.locator("#guia-celulares .botao").click();
    await expect(page.locator(".news-detail-lateral a")).toHaveCount(0);
    await page.locator('[data-news-id="justica-pm-zona-leste-sp"]')
        .getByRole("button", { name: /Ver resumo:/ }).click();
    const fonte = page.locator(".news-detail-lateral a");
    await expect(page.locator(".news-detail-lateral h3")).toHaveText("Justiça torna ré PM por homicídio de mulher na Zona Leste de SP");
    await expect(page.locator(".news-detail-lateral")).toContainText("A decisão aceita a denúncia por homicídio triplamente qualificado");
    await expect(fonte).toHaveAttribute("target", "_blank");
    await expect(fonte).toHaveAttribute("rel", "noopener noreferrer");
});

test("menu e conteúdo não criam overflow horizontal no móvel", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const dimensoes = await page.evaluate(() => ({ largura: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.viewport);
});

test("navegação marca a editoria acionada", async ({ page }) => {
    if ((page.viewportSize()?.width || 1280) <= 600) {
        await page.getByRole("button", { name: "Editorias" }).click();
    }
    const link = page.getByRole("link", { name: "Mundo", exact: true });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "location");
});
