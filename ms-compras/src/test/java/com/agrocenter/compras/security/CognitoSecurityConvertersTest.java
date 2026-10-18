package com.agrocenter.compras.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CognitoSecurityConvertersTest {

    @Test
    void convierteSoloRolesConocidosYConservaScopes() {
        Jwt jwt = jwt(Map.of(
                "scope", "compras.read compras.write",
                "cognito:groups", List.of("ADMIN", "DESCONOCIDO"),
                "custom:role", "CLIENTE"
        ));

        assertThat(new CognitoAuthoritiesConverter().convert(jwt))
                .extracting(Object::toString)
                .containsExactlyInAnyOrder(
                        "SCOPE_compras.read",
                        "SCOPE_compras.write",
                        "ROLE_ADMIN",
                        "ROLE_CLIENTE"
                );
    }

    @Test
    void validaAudienceOClientIdYExigeAccessToken() {
        CognitoAudienceValidator audienceValidator = new CognitoAudienceValidator("agrocenter-api");
        CognitoTokenUseValidator tokenUseValidator = new CognitoTokenUseValidator();

        assertThat(audienceValidator.validate(jwt(Map.of(
                "client_id", "agrocenter-api",
                "token_use", "access"
        ))).hasErrors()).isFalse();
        assertThat(audienceValidator.validate(jwt(Map.of("aud", List.of("otra-api")))).hasErrors())
                .isTrue();
        assertThat(tokenUseValidator.validate(jwt(Map.of("token_use", "id"))).hasErrors()).isTrue();
    }

    private Jwt jwt(Map<String, Object> claims) {
        Instant now = Instant.parse("2026-08-29T16:00:00Z");
        return new Jwt(
                "token",
                now,
                now.plusSeconds(300),
                Map.of("alg", "RS256"),
                claims
        );
    }
}
