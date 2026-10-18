package com.agrocenter.compras.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record DetalleRequest(
        @NotNull @Positive Long productoId,
        @NotNull @Positive Integer cantidad,
        @NotNull @Positive @Digits(integer = 13, fraction = 2) BigDecimal precioUnitario
) {
}
