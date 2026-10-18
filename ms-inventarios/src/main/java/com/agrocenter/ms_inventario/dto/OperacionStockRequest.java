package com.agrocenter.ms_inventario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record OperacionStockRequest(
        @NotNull Long productoId,
        @NotNull @Positive Integer cantidad,
        @NotBlank @Size(max = 100) String referencia
) {
}
