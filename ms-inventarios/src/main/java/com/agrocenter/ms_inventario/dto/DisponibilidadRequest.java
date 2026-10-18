package com.agrocenter.ms_inventario.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record DisponibilidadRequest(
        @NotNull Long productoId,
        @NotNull @Positive Integer cantidad
) {
}
