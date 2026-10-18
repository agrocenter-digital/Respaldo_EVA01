package com.agrocenter.compras.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DtoValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void aceptaUnaOrdenValida() {
        OrdenCompraRequest request = new OrdenCompraRequest(
                7L,
                List.of(new DetalleRequest(10L, 2, new BigDecimal("1250.50")))
        );

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rechazaProveedorYDetallesInvalidos() {
        OrdenCompraRequest request = new OrdenCompraRequest(
                0L,
                List.of(new DetalleRequest(-1L, 0, new BigDecimal("0.001")))
        );

        assertThat(validator.validate(request))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("proveedorId", "detalles[0].productoId", "detalles[0].cantidad",
                        "detalles[0].precioUnitario");
    }

    @Test
    void limitaLaCantidadDeDetalles() {
        List<DetalleRequest> detalles = java.util.stream.LongStream.rangeClosed(1, 101)
                .mapToObj(id -> new DetalleRequest(id, 1, BigDecimal.ONE))
                .toList();

        assertThat(validator.validate(new OrdenCompraRequest(1L, detalles)))
                .extracting(violation -> violation.getPropertyPath().toString())
                .contains("detalles");
    }
}
