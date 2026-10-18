package com.agrocenter.compras.service;

import com.agrocenter.compras.client.InventoryClient;
import com.agrocenter.compras.client.dto.InventoryStockResponse;
import com.agrocenter.compras.dto.DetalleRequest;
import com.agrocenter.compras.dto.OrdenCompraRequest;
import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.exception.ApiException;
import com.agrocenter.compras.exception.IntegracionInventarioException;
import com.agrocenter.compras.exception.InventarioNoDisponibleException;
import com.agrocenter.compras.exception.SolicitudInvalidaException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrdenCompraService {

    private static final int MONEY_SCALE = 2;
    private static final int MONEY_PRECISION = 15;
    private static final String CANCELLATION_REASON = "No fue posible completar el reabastecimiento";

    private final OrdenCompraPersistenceService persistenceService;
    private final InventoryClient inventoryClient;

    public OrdenCompraResponse crearOrden(
            OrdenCompraRequest request,
            String bearerToken,
            String correlationId
    ) {
        validarProductosDuplicados(request.detalles());
        List<DetallePreparado> detalles = prepararDetalles(request.detalles());
        BigDecimal total = detalles.stream()
                .map(DetallePreparado::subtotal)
                .reduce(BigDecimal.ZERO.setScale(MONEY_SCALE), BigDecimal::add);
        validarMonto(total);

        OrdenCompraResponse pendiente = persistenceService.crearPendiente(
                request.proveedorId(),
                detalles,
                total
        );
        log.info(
                "Orden de compra pendiente creada ordenId={} proveedorId={} correlationId={}",
                pendiente.id(),
                pendiente.proveedorId(),
                correlationId
        );

        List<DetallePreparado> ingresosConfirmados = new ArrayList<>();
        try {
            String referencia = "COMPRA-" + pendiente.id();
            for (DetallePreparado detalle : detalles) {
                InventoryStockResponse response = inventoryClient.ingresarStock(
                        detalle.productoId(),
                        detalle.cantidad(),
                        referencia,
                        bearerToken,
                        correlationId
                );
                ingresosConfirmados.add(detalle);
                validarRespuestaInventario(response, detalle, referencia, "ENTRADA");
            }

            OrdenCompraResponse completada = persistenceService.completar(pendiente.id());
            log.info(
                    "Orden de compra completada ordenId={} proveedorId={} correlationId={}",
                    completada.id(),
                    completada.proveedorId(),
                    correlationId
            );
            return completada;
        } catch (ApiException exception) {
            cancelarYCompensar(
                    pendiente.id(),
                    ingresosConfirmados,
                    bearerToken,
                    correlationId,
                    exception instanceof InventarioNoDisponibleException
            );
            throw exception;
        } catch (RuntimeException exception) {
            cancelarYCompensar(
                    pendiente.id(),
                    ingresosConfirmados,
                    bearerToken,
                    correlationId,
                    false
            );
            throw exception;
        }
    }

    public List<OrdenCompraResponse> listarTodas() {
        return persistenceService.listarTodas();
    }

    public OrdenCompraResponse obtenerPorId(Long id) {
        return persistenceService.obtenerPorId(id);
    }

    private List<DetallePreparado> prepararDetalles(List<DetalleRequest> requests) {
        return requests.stream().map(detalle -> {
            BigDecimal precio = detalle.precioUnitario().setScale(MONEY_SCALE, RoundingMode.HALF_UP);
            BigDecimal subtotal = precio.multiply(BigDecimal.valueOf(detalle.cantidad()))
                    .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
            validarMonto(subtotal);
            return new DetallePreparado(
                    detalle.productoId(),
                    detalle.cantidad(),
                    precio,
                    subtotal
            );
        }).toList();
    }

    private void validarProductosDuplicados(List<DetalleRequest> detalles) {
        Set<Long> productos = new HashSet<>();
        boolean duplicado = detalles.stream()
                .anyMatch(detalle -> !productos.add(detalle.productoId()));
        if (duplicado) {
            throw new SolicitudInvalidaException(
                    "DUPLICATE_PRODUCT",
                    "No se permiten productos duplicados en una orden de compra"
            );
        }
    }

    private void validarMonto(BigDecimal monto) {
        if (monto.precision() > MONEY_PRECISION) {
            throw new SolicitudInvalidaException(
                    "PURCHASE_AMOUNT_EXCEEDS_LIMIT",
                    "El monto de la orden excede el limite permitido"
            );
        }
    }

    private void validarRespuestaInventario(
            InventoryStockResponse response,
            DetallePreparado detalle,
            String referencia,
            String tipoEsperado
    ) {
        if (response == null
                || !detalle.productoId().equals(response.productoId())
                || !detalle.cantidad().equals(response.cantidad())
                || response.tipoMovimiento() == null
                || !tipoEsperado.equalsIgnoreCase(response.tipoMovimiento())
                || response.referencia() == null
                || !referencia.equalsIgnoreCase(response.referencia())) {
            throw new IntegracionInventarioException();
        }
    }

    private void cancelarYCompensar(
            Long ordenId,
            List<DetallePreparado> ingresosConfirmados,
            String bearerToken,
            String correlationId,
            boolean resultadoRemotoDesconocido
    ) {
        boolean compensacionCompleta = compensar(
                ordenId,
                ingresosConfirmados,
                bearerToken,
                correlationId
        );
        compensacionCompleta = compensacionCompleta && !resultadoRemotoDesconocido;
        String motivo = compensacionCompleta
                ? CANCELLATION_REASON
                : CANCELLATION_REASON + "; conciliacion de inventario pendiente de revision";
        try {
            persistenceService.cancelar(ordenId, motivo);
        } catch (RuntimeException cancellationException) {
            log.error(
                    "No fue posible persistir la cancelacion ordenId={} correlationId={}",
                    ordenId,
                    correlationId,
                    cancellationException
            );
        }
        log.warn(
                "Orden de compra cancelada ordenId={} correlationId={} compensada={}",
                ordenId,
                correlationId,
                compensacionCompleta
        );
    }

    private boolean compensar(
            Long ordenId,
            List<DetallePreparado> ingresosConfirmados,
            String bearerToken,
            String correlationId
    ) {
        boolean completa = true;
        String referencia = "COMPENSACION-COMPRA-" + ordenId;
        for (int index = ingresosConfirmados.size() - 1; index >= 0; index--) {
            DetallePreparado detalle = ingresosConfirmados.get(index);
            try {
                InventoryStockResponse response = inventoryClient.compensarEntrada(
                        detalle.productoId(),
                        detalle.cantidad(),
                        referencia,
                        bearerToken,
                        correlationId
                );
                validarRespuestaInventario(response, detalle, referencia, "SALIDA");
            } catch (ApiException exception) {
                completa = false;
                log.error(
                        "Compensacion de inventario pendiente ordenId={} productoId={} correlationId={}",
                        ordenId,
                        detalle.productoId(),
                        correlationId
                );
            }
        }
        return completa;
    }
}
