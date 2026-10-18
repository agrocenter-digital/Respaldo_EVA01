package com.agrocenter.ms_inventario.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class DtoValidationTest {

    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void aceptaProductoValido() {
        ProductoCreateRequest request = new ProductoCreateRequest(
                "FER-001",
                "Fertilizante",
                null,
                "Fertilizantes",
                new BigDecimal("18990.00"),
                5
        );

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rechazaProductoConCamposInvalidos() {
        ProductoCreateRequest request = new ProductoCreateRequest(
                " ",
                " ",
                null,
                " ",
                new BigDecimal("-1.00"),
                -1
        );

        assertThat(validator.validate(request)).hasSizeGreaterThanOrEqualTo(5);
    }

    @Test
    void rechazaOperacionDeStockSinCantidadNiReferenciaValidas() {
        OperacionStockRequest request = new OperacionStockRequest(1L, 0, " ");

        assertThat(validator.validate(request)).hasSize(2);
    }
}
