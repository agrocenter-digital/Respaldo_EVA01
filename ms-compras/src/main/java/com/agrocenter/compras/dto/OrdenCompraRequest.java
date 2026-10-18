package com.agrocenter.compras.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record OrdenCompraRequest(
        @NotNull @Positive Long proveedorId,
        @NotEmpty @Size(max = 100) List<@NotNull @Valid DetalleRequest> detalles
) {
}
