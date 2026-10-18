package com.agrocenter.ms_inventario.dto;

import java.time.Instant;

public record DevTokenResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        Instant expiresAt,
        DevTokenRole rol
) {
}
