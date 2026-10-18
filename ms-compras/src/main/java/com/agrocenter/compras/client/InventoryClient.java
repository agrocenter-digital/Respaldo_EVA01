package com.agrocenter.compras.client;

import com.agrocenter.compras.client.dto.InventoryErrorResponse;
import com.agrocenter.compras.client.dto.InventoryStockRequest;
import com.agrocenter.compras.client.dto.InventoryStockResponse;
import com.agrocenter.compras.config.InventoryProperties;
import com.agrocenter.compras.exception.ApiException;
import com.agrocenter.compras.exception.ConflictoInventarioException;
import com.agrocenter.compras.exception.IntegracionInventarioException;
import com.agrocenter.compras.exception.InventarioNoDisponibleException;
import com.agrocenter.compras.exception.ProductoNoEncontradoException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import reactor.core.publisher.Mono;

import java.util.concurrent.TimeoutException;

@Slf4j
@Component
public class InventoryClient {

    private static final String CORRELATION_HEADER = "X-Correlation-ID";

    private final WebClient webClient;
    private final InventoryProperties properties;

    public InventoryClient(WebClient inventoryWebClient, InventoryProperties properties) {
        this.webClient = inventoryWebClient;
        this.properties = properties;
    }

    public InventoryStockResponse ingresarStock(
            Long productoId,
            Integer cantidad,
            String referencia,
            String forwardedToken,
            String correlationId
    ) {
        return operacionStock(
                "/api/inventario/stock/entrada",
                new InventoryStockRequest(productoId, cantidad, referencia),
                forwardedToken,
                correlationId,
                "registrar entrada"
        );
    }

    public InventoryStockResponse compensarEntrada(
            Long productoId,
            Integer cantidad,
            String referencia,
            String forwardedToken,
            String correlationId
    ) {
        return operacionStock(
                "/api/inventario/stock/salida",
                new InventoryStockRequest(productoId, cantidad, referencia),
                forwardedToken,
                correlationId,
                "compensar entrada"
        );
    }

    private InventoryStockResponse operacionStock(
            String path,
            InventoryStockRequest request,
            String forwardedToken,
            String correlationId,
            String operation
    ) {
        return ejecutar(
                webClient.post()
                        .uri(path)
                        .header(HttpHeaders.AUTHORIZATION, bearer(forwardedToken))
                        .header(CORRELATION_HEADER, correlationId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(request)
                        .exchangeToMono(response -> leerRespuesta(response, InventoryStockResponse.class)),
                operation
        );
    }

    private <T> Mono<T> leerRespuesta(ClientResponse response, Class<T> responseType) {
        if (response.statusCode().is2xxSuccessful()) {
            return response.bodyToMono(responseType);
        }

        return response.bodyToMono(InventoryErrorResponse.class)
                .onErrorReturn(new InventoryErrorResponse(null))
                .defaultIfEmpty(new InventoryErrorResponse(null))
                .flatMap(error -> {
                    int status = response.statusCode().value();
                    if (status == HttpStatus.NOT_FOUND.value()) {
                        return Mono.error(new ProductoNoEncontradoException());
                    }
                    if (status == HttpStatus.CONFLICT.value()) {
                        return Mono.error(new ConflictoInventarioException());
                    }
                    if (response.statusCode().is5xxServerError()) {
                        return Mono.error(new InventarioNoDisponibleException());
                    }
                    return Mono.error(new IntegracionInventarioException());
                });
    }

    private <T> T ejecutar(Mono<T> operation, String operationName) {
        try {
            T result = operation.timeout(properties.readTimeout()).block();
            if (result == null) {
                throw new IntegracionInventarioException();
            }
            return result;
        } catch (ApiException exception) {
            throw exception;
        } catch (WebClientRequestException exception) {
            log.warn("Fallo de transporte al {} en ms-inventario", operationName);
            throw new InventarioNoDisponibleException();
        } catch (RuntimeException exception) {
            if (exception.getCause() instanceof TimeoutException) {
                log.warn("Timeout al {} en ms-inventario", operationName);
            } else {
                log.warn("Fallo inesperado al {} en ms-inventario", operationName);
            }
            throw new InventarioNoDisponibleException();
        }
    }

    private String bearer(String forwardedToken) {
        String selectedToken = properties.serviceToken().isBlank()
                ? forwardedToken
                : properties.serviceToken();
        if (selectedToken == null || selectedToken.isBlank()) {
            throw new InventarioNoDisponibleException();
        }
        return selectedToken.regionMatches(true, 0, "Bearer ", 0, 7)
                ? selectedToken
                : "Bearer " + selectedToken;
    }
}
