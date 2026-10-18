package com.agrocenter.ms_inventario.integration;

import com.agrocenter.ms_inventario.dto.OperacionStockRequest;
import com.agrocenter.ms_inventario.dto.ProductoCreateRequest;
import com.agrocenter.ms_inventario.dto.ProductoResponse;
import com.agrocenter.ms_inventario.exception.ConflictoNegocioException;
import com.agrocenter.ms_inventario.repository.MovimientoInventarioRepository;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import com.agrocenter.ms_inventario.service.InventarioService;
import com.agrocenter.ms_inventario.service.ProductoService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class InventarioConcurrencyIntegrationTest {

    @Autowired
    private ProductoService productoService;

    @Autowired
    private InventarioService inventarioService;

    @Autowired
    private MovimientoInventarioRepository movimientoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    private ExecutorService executor;

    @BeforeEach
    void setUp() {
        movimientoRepository.deleteAll();
        productoRepository.deleteAll();
        executor = Executors.newFixedThreadPool(2);
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void evitaStockNegativoAnteDosVentasSimultaneas() throws Exception {
        ProductoResponse producto = crearProducto("CON-001");
        inventarioService.registrarEntrada(
                new OperacionStockRequest(producto.id(), 10, "COMPRA-CONCURRENCIA")
        );

        CountDownLatch inicio = new CountDownLatch(1);
        Callable<Boolean> ventaUno = ventaConcurrente(producto.id(), "VENTA-CON-1", inicio);
        Callable<Boolean> ventaDos = ventaConcurrente(producto.id(), "VENTA-CON-2", inicio);
        Future<Boolean> resultadoUno = executor.submit(ventaUno);
        Future<Boolean> resultadoDos = executor.submit(ventaDos);
        inicio.countDown();

        List<Boolean> resultados = List.of(resultadoUno.get(), resultadoDos.get());
        assertThat(resultados).containsExactlyInAnyOrder(true, false);
        assertThat(inventarioService.consultarStock(producto.id(), true).stockActual()).isEqualTo(3);
    }

    @Test
    void repiteReferenciaSinAplicarDosVecesLaEntrada() {
        ProductoResponse producto = crearProducto("IDEM-001");
        OperacionStockRequest request = new OperacionStockRequest(producto.id(), 5, "COMPRA-IDEM-1");

        assertThat(inventarioService.registrarEntrada(request).duplicada()).isFalse();
        assertThat(inventarioService.registrarEntrada(request).duplicada()).isTrue();
        assertThat(inventarioService.consultarStock(producto.id(), true).stockActual()).isEqualTo(5);
        assertThat(movimientoRepository.count()).isEqualTo(1);
    }

    private Callable<Boolean> ventaConcurrente(
            Long productoId,
            String referencia,
            CountDownLatch inicio
    ) {
        return () -> {
            inicio.await();
            try {
                inventarioService.registrarSalida(
                        new OperacionStockRequest(productoId, 7, referencia)
                );
                return true;
            } catch (ConflictoNegocioException exception) {
                return false;
            }
        };
    }

    private ProductoResponse crearProducto(String sku) {
        return productoService.crear(new ProductoCreateRequest(
                sku,
                "Producto concurrente",
                null,
                "Pruebas",
                new BigDecimal("1000.00"),
                2
        ));
    }
}
