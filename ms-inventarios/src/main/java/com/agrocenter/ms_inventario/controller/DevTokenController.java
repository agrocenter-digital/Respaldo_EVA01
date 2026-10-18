package com.agrocenter.ms_inventario.controller;

import com.agrocenter.ms_inventario.dto.DevTokenRequest;
import com.agrocenter.ms_inventario.dto.DevTokenResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@RestController
@Profile("dev & !prod")
@RequestMapping("/api/dev")
@Tag(name = "Desarrollo", description = "Herramientas disponibles solo en el perfil dev")
public class DevTokenController {

    private final JwtEncoder jwtEncoder;
    private final String issuer;
    private final String audience;
    private final long tokenTtlSeconds;

    public DevTokenController(
            JwtEncoder jwtEncoder,
            @Value("${agrocenter.security.dev.issuer}") String issuer,
            @Value("${agrocenter.security.dev.audience}") String audience,
            @Value("${agrocenter.security.dev.token-ttl-seconds:3600}") long tokenTtlSeconds
    ) {
        if (tokenTtlSeconds < 60 || tokenTtlSeconds > 86400) {
            throw new IllegalArgumentException(
                    "DEV_JWT_TTL_SECONDS debe estar entre 60 y 86400"
            );
        }
        this.jwtEncoder = jwtEncoder;
        this.issuer = issuer;
        this.audience = audience;
        this.tokenTtlSeconds = tokenTtlSeconds;
    }

    @PostMapping("/token")
    @SecurityRequirements
    @Operation(
            summary = "Generar un JWT local",
            description = "Solo existe en el perfil dev; nunca debe habilitarse en produccion"
    )
    public DevTokenResponse generar(@Valid @RequestBody DevTokenRequest request) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(tokenTtlSeconds, ChronoUnit.SECONDS);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(request.usuario())
                .audience(List.of(audience))
                .issuedAt(issuedAt)
                .notBefore(issuedAt)
                .expiresAt(expiresAt)
                .id(UUID.randomUUID().toString())
                .claim("cognito:groups", List.of(request.rol().name()))
                .claim("scope", scopesPara(request))
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
                .type("JWT")
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims))
                .getTokenValue();

        return new DevTokenResponse(
                token,
                "Bearer",
                tokenTtlSeconds,
                expiresAt,
                request.rol()
        );
    }

    private String scopesPara(DevTokenRequest request) {
        return switch (request.rol()) {
            case ADMIN -> "inventario.stock.read inventario.stock.write";
            case CLIENTE -> "inventario.stock.read";
        };
    }
}
