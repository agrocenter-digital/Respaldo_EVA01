package com.agrocenter.compras.client;

import com.agrocenter.compras.client.dto.InventoryStockResponse;
import com.agrocenter.compras.config.InventoryProperties;
import com.agrocenter.compras.exception.InventarioNoDisponibleException;
import com.agrocenter.compras.exception.ProductoNoEncontradoException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InventoryClientTest {

    private HttpServer server;
    private volatile StubResponse stubResponse;
    private volatile String lastPath;
    private volatile String lastAuthorization;
    private volatile String lastCorrelationId;
    private volatile String lastBody;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", this::handle);
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void usaElContratoRealDeEntradaYPropagaEncabezados() {
        respond(200, """
                {
                  "movimientoId": 18,
                  "productoId": 10,
                  "sku": "SEM-010",
                  "tipoMovimiento": "ENTRADA",
                  "cantidad": 5,
                  "stockAnterior": 8,
                  "stockPosterior": 13,
                  "referencia": "COMPRA-25",
                  "duplicada": false,
                  "fecha": "2026-08-29T16:00:00Z"
                }
                """, Duration.ZERO);

        InventoryStockResponse response = client(Duration.ofSeconds(5))
                .ingresarStock(10L, 5, "COMPRA-25", "jwt-admin", "corr-25");

        assertThat(response.stockPosterior()).isEqualTo(13);
        assertThat(lastPath).isEqualTo("/api/inventario/stock/entrada");
        assertThat(lastAuthorization).isEqualTo("Bearer jwt-admin");
        assertThat(lastCorrelationId).isEqualTo("corr-25");
        assertThat(lastBody).contains("\"productoId\":10", "\"referencia\":\"COMPRA-25\"")
                .doesNotContain("tipoMovimiento");
    }

    @Test
    void traduce404AProductoNoEncontrado() {
        respond(404, "{\"message\":\"Producto no encontrado\"}", Duration.ZERO);

        assertThatThrownBy(() -> client(Duration.ofSeconds(5))
                .ingresarStock(99L, 1, "COMPRA-1", "jwt", "corr"))
                .isInstanceOf(ProductoNoEncontradoException.class);
    }

    @Test
    void cortaLaEsperaAlSuperarElTimeout() {
        respond(200, """
                {
                  "movimientoId": 18,
                  "productoId": 10,
                  "sku": "SEM-010",
                  "tipoMovimiento": "ENTRADA",
                  "cantidad": 1,
                  "stockAnterior": 8,
                  "stockPosterior": 9,
                  "referencia": "COMPRA-1",
                  "duplicada": false,
                  "fecha": "2026-08-29T16:00:00Z"
                }
                """, Duration.ofMillis(300));

        assertThatThrownBy(() -> client(Duration.ofMillis(50))
                .ingresarStock(10L, 1, "COMPRA-1", "jwt", "corr"))
                .isInstanceOf(InventarioNoDisponibleException.class);
    }

    private InventoryClient client(Duration readTimeout) {
        String baseUrl = "http://localhost:" + server.getAddress().getPort();
        InventoryProperties properties = new InventoryProperties(
                baseUrl,
                Duration.ofSeconds(1),
                readTimeout,
                ""
        );
        return new InventoryClient(WebClient.builder().baseUrl(baseUrl).build(), properties);
    }

    private void respond(int status, String body, Duration delay) {
        this.stubResponse = new StubResponse(status, body, delay);
    }

    private void handle(HttpExchange exchange) throws IOException {
        StubResponse current = stubResponse;
        lastPath = exchange.getRequestURI().getPath();
        lastAuthorization = exchange.getRequestHeaders().getFirst("Authorization");
        lastCorrelationId = exchange.getRequestHeaders().getFirst("X-Correlation-ID");
        lastBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        try {
            Thread.sleep(current.delay().toMillis());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
        byte[] responseBody = current.body().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(current.status(), responseBody.length);
        exchange.getResponseBody().write(responseBody);
        exchange.close();
    }

    private record StubResponse(int status, String body, Duration delay) {
    }
}
