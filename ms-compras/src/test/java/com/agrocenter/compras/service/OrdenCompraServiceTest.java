package com.agrocenter.compras.service;

import com.agrocenter.compras.client.InventoryClient;
import com.agrocenter.compras.client.dto.InventoryStockResponse;
import com.agrocenter.compras.dto.DetalleOrdenCompraResponse;
import com.agrocenter.compras.dto.DetalleRequest;
import com.agrocenter.compras.dto.OrdenCompraRequest;
import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.entity.EstadoOrden;
import com.agrocenter.compras.exception.ProductoNoEncontradoException;
import com.agrocenter.compras.exception.SolicitudInvalidaException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrdenCompraServiceTest {

    @Mock
    private OrdenCompraPersistenceService persistenceService;

    @Mock
    private InventoryClient inventoryClient;

    private OrdenCompraService service;

    @BeforeEach
    void setUp() {
        service = new OrdenCompraService(persistenceService, inventoryClient);
    }

    @Test
    void completaLaOrdenSoloDespuesDeRegistrarTodasLasEntradas() {
        OrdenCompraRequest request = request();
        when(persistenceService.crearPendiente(eq(7L), anyList(), eq(new BigDecimal("400.00"))))
                .thenReturn(response(25L, EstadoOrden.PENDIENTE));
        when(inventoryClient.ingresarStock(10L, 2, "COMPRA-25", "jwt-admin", "corr-25"))
                .thenReturn(stock(10L, 2, "ENTRADA", "COMPRA-25"));
        when(inventoryClient.ingresarStock(11L, 1, "COMPRA-25", "jwt-admin", "corr-25"))
                .thenReturn(stock(11L, 1, "ENTRADA", "COMPRA-25"));
        when(persistenceService.completar(25L))
                .thenReturn(response(25L, EstadoOrden.COMPLETADA));

        OrdenCompraResponse result = service.crearOrden(request, "jwt-admin", "corr-25");

        assertThat(result.estado()).isEqualTo(EstadoOrden.COMPLETADA);
        verify(persistenceService).completar(25L);
        verify(persistenceService, never()).cancelar(any(), any());
    }

    @Test
    void compensaEntradasPreviasYCancelaCuandoFallaUnProducto() {
        OrdenCompraRequest request = request();
        when(persistenceService.crearPendiente(eq(7L), anyList(), eq(new BigDecimal("400.00"))))
                .thenReturn(response(25L, EstadoOrden.PENDIENTE));
        when(inventoryClient.ingresarStock(10L, 2, "COMPRA-25", "jwt-admin", "corr-25"))
                .thenReturn(stock(10L, 2, "ENTRADA", "COMPRA-25"));
        when(inventoryClient.ingresarStock(11L, 1, "COMPRA-25", "jwt-admin", "corr-25"))
                .thenThrow(new ProductoNoEncontradoException());
        when(inventoryClient.compensarEntrada(
                10L,
                2,
                "COMPENSACION-COMPRA-25",
                "jwt-admin",
                "corr-25"
        )).thenReturn(stock(10L, 2, "SALIDA", "COMPENSACION-COMPRA-25"));
        when(persistenceService.cancelar(eq(25L), any()))
                .thenReturn(response(25L, EstadoOrden.CANCELADA));

        assertThatThrownBy(() -> service.crearOrden(request, "jwt-admin", "corr-25"))
                .isInstanceOf(ProductoNoEncontradoException.class);

        verify(inventoryClient).compensarEntrada(
                10L,
                2,
                "COMPENSACION-COMPRA-25",
                "jwt-admin",
                "corr-25"
        );
        verify(persistenceService).cancelar(eq(25L), any());
        verify(persistenceService, never()).completar(any());
    }

    @Test
    void rechazaProductosDuplicadosAntesDePersistir() {
        OrdenCompraRequest request = new OrdenCompraRequest(
                7L,
                List.of(
                        new DetalleRequest(10L, 1, new BigDecimal("100.00")),
                        new DetalleRequest(10L, 2, new BigDecimal("100.00"))
                )
        );

        assertThatThrownBy(() -> service.crearOrden(request, "jwt-admin", "corr"))
                .isInstanceOf(SolicitudInvalidaException.class)
                .hasMessageContaining("duplicados");
        verify(persistenceService, never()).crearPendiente(any(), anyList(), any());
    }

    private OrdenCompraRequest request() {
        return new OrdenCompraRequest(
                7L,
                List.of(
                        new DetalleRequest(10L, 2, new BigDecimal("100.00")),
                        new DetalleRequest(11L, 1, new BigDecimal("200.00"))
                )
        );
    }

    private OrdenCompraResponse response(Long id, EstadoOrden estado) {
        LocalDateTime now = LocalDateTime.of(2026, 8, 29, 12, 0);
        return new OrdenCompraResponse(
                id,
                7L,
                now,
                estado,
                new BigDecimal("400.00"),
                List.of(
                        new DetalleOrdenCompraResponse(1L, 10L, 2,
                                new BigDecimal("100.00"), new BigDecimal("200.00")),
                        new DetalleOrdenCompraResponse(2L, 11L, 1,
                                new BigDecimal("200.00"), new BigDecimal("200.00"))
                )
        );
    }

    private InventoryStockResponse stock(
            Long productoId,
            Integer cantidad,
            String tipo,
            String referencia
    ) {
        return new InventoryStockResponse(
                1L,
                productoId,
                "SKU-" + productoId,
                tipo,
                cantidad,
                10,
                10 + cantidad,
                referencia,
                false,
                Instant.parse("2026-08-29T16:00:00Z")
        );
    }
}
