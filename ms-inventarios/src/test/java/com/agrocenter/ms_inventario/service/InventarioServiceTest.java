package com.agrocenter.ms_inventario.service;

import com.agrocenter.ms_inventario.dto.OperacionStockRequest;
import com.agrocenter.ms_inventario.dto.OperacionStockResponse;
import com.agrocenter.ms_inventario.entity.MovimientoInventario;
import com.agrocenter.ms_inventario.entity.OrigenMovimiento;
import com.agrocenter.ms_inventario.entity.Producto;
import com.agrocenter.ms_inventario.entity.TipoMovimiento;
import com.agrocenter.ms_inventario.exception.ConflictoNegocioException;
import com.agrocenter.ms_inventario.mapper.InventarioMapper;
import com.agrocenter.ms_inventario.repository.MovimientoInventarioRepository;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventarioServiceTest {

    @Mock
    private ProductoRepository productoRepository;

    @Mock
    private MovimientoInventarioRepository movimientoRepository;

    private InventarioService inventarioService;
    private Producto producto;

    @BeforeEach
    void setUp() {
        inventarioService = new InventarioService(
                productoRepository,
                movimientoRepository,
                new InventarioMapper()
        );
        producto = new Producto(
                "SEM-001",
                "Semilla de maiz",
                null,
                "Semillas",
                new BigDecimal("24990.00"),
                5
        );
    }

    @Test
    void incrementaStock() {
        prepararMovimientoNuevo(TipoMovimiento.ENTRADA, "COMPRA-123");

        OperacionStockResponse response = inventarioService.registrarEntrada(
                new OperacionStockRequest(1L, 50, "compra-123")
        );

        assertThat(producto.getStockActual()).isEqualTo(50);
        assertThat(response.stockPosterior()).isEqualTo(50);
        assertThat(response.duplicada()).isFalse();
    }

    @Test
    void descuentaStockDisponible() {
        producto.incrementarStock(10);
        prepararMovimientoNuevo(TipoMovimiento.SALIDA, "VENTA-928");

        OperacionStockResponse response = inventarioService.registrarSalida(
                new OperacionStockRequest(1L, 4, "VENTA-928")
        );

        assertThat(producto.getStockActual()).isEqualTo(6);
        assertThat(response.stockAnterior()).isEqualTo(10);
        assertThat(response.stockPosterior()).isEqualTo(6);
    }

    @Test
    void rechazaSalidaConStockInsuficienteSinDejarStockNegativo() {
        producto.incrementarStock(3);
        when(productoRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(producto));
        when(movimientoRepository.findByProductoIdAndTipoMovimientoAndReferencia(
                null,
                TipoMovimiento.SALIDA,
                "VENTA-929"
        )).thenReturn(Optional.empty());

        assertThatThrownBy(() -> inventarioService.registrarSalida(
                new OperacionStockRequest(1L, 4, "VENTA-929")
        )).isInstanceOf(ConflictoNegocioException.class)
                .hasMessageContaining("Stock insuficiente");

        assertThat(producto.getStockActual()).isEqualTo(3);
        verify(movimientoRepository, never()).save(any());
    }

    @Test
    void generaMovimientoConTrazabilidadCompleta() {
        producto.incrementarStock(10);
        prepararMovimientoNuevo(TipoMovimiento.SALIDA, "VENTA-930");
        ArgumentCaptor<MovimientoInventario> captor = ArgumentCaptor.forClass(MovimientoInventario.class);

        inventarioService.registrarSalida(new OperacionStockRequest(1L, 2, "venta-930"));

        verify(movimientoRepository).save(captor.capture());
        MovimientoInventario movimiento = captor.getValue();
        assertThat(movimiento.getTipoMovimiento()).isEqualTo(TipoMovimiento.SALIDA);
        assertThat(movimiento.getOrigen()).isEqualTo(OrigenMovimiento.MS_VENTAS);
        assertThat(movimiento.getStockAnterior()).isEqualTo(10);
        assertThat(movimiento.getStockPosterior()).isEqualTo(8);
        assertThat(movimiento.getReferencia()).isEqualTo("VENTA-930");
    }

    @Test
    void unaOperacionDuplicadaNoModificaNuevamenteElStock() {
        producto.incrementarStock(5);
        MovimientoInventario existente = new MovimientoInventario(
                producto,
                TipoMovimiento.ENTRADA,
                5,
                0,
                5,
                "COMPRA-500",
                OrigenMovimiento.MS_COMPRAS
        );
        when(productoRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(producto));
        when(movimientoRepository.findByProductoIdAndTipoMovimientoAndReferencia(
                null,
                TipoMovimiento.ENTRADA,
                "COMPRA-500"
        )).thenReturn(Optional.of(existente));

        OperacionStockResponse response = inventarioService.registrarEntrada(
                new OperacionStockRequest(1L, 5, "COMPRA-500")
        );

        assertThat(response.duplicada()).isTrue();
        assertThat(producto.getStockActual()).isEqualTo(5);
        verify(movimientoRepository, never()).save(any());
    }

    private void prepararMovimientoNuevo(TipoMovimiento tipo, String referencia) {
        when(productoRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(producto));
        when(movimientoRepository.findByProductoIdAndTipoMovimientoAndReferencia(
                null,
                tipo,
                referencia
        )).thenReturn(Optional.empty());
        when(movimientoRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }
}
