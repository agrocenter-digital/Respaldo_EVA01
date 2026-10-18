package com.agrocenter.ms_inventario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DevTokenRequest(
        @NotBlank @Size(max = 80) String usuario,
        @NotNull DevTokenRole rol
) {
}
