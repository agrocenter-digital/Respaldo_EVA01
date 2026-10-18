package com.agrocenter.ms_inventario.service;

import com.agrocenter.ms_inventario.dto.ProductoCreateRequest;
import com.agrocenter.ms_inventario.dto.ProductoResponse;
import com.agrocenter.ms_inventario.exception.RecursoNoEncontradoException;
import com.agrocenter.ms_inventario.mapper.InventarioMapper;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductoServiceTest {

    @Mock
    private ProductoRepository productoRepository;

    private ProductoService productoService;

    @BeforeEach
    void setUp() {
        productoService = new ProductoService(productoRepository, new InventarioMapper());
    }

    @Test
    void creaProductoValidoConStockInicialCero() {
        ProductoCreateRequest request = new ProductoCreateRequest(
                " sem-001 ",
                "Semilla de maiz",
                "Saco de semillas",
                "Semillas",
                new BigDecimal("24990.00"),
                10
        );
        when(productoRepository.existsBySkuIgnoreCase("SEM-001")).thenReturn(false);
        when(productoRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ProductoResponse response = productoService.crear(request);

        assertThat(response.sku()).isEqualTo("SEM-001");
        assertThat(response.stockActual()).isZero();
        assertThat(response.activo()).isTrue();
    }

    @Test
    void informaProductoInexistente() {
        when(productoRepository.findById(99L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> productoService.obtenerPorId(99L, true))
                .isInstanceOf(RecursoNoEncontradoException.class)
                .hasMessage("Producto no encontrado");
    }
}
