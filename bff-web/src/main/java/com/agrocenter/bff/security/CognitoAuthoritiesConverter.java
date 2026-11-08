package com.agrocenter.bff.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class CognitoAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "CLIENTE");
    private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        Collection<GrantedAuthority> scopes = scopeConverter.convert(jwt);
        if (scopes != null) {
            authorities.addAll(scopes);
        }

        // Extracción exhaustiva de claims de roles/grupos desde Cognito o IdPs
        extractAndAddRoles(authorities, jwt, "cognito:groups");
        extractAndAddRoles(authorities, jwt, "roles");
        extractAndAddRoles(authorities, jwt, "role");
        extractAndAddRoles(authorities, jwt, "groups");
        extractAndAddRoles(authorities, jwt, "group");
        extractAndAddRoles(authorities, jwt, "custom:role");
        extractAndAddRoles(authorities, jwt, "authorities");

        return authorities;
    }

    private void extractAndAddRoles(Set<GrantedAuthority> authorities, Jwt jwt, String claimName) {
        Object claimValue = jwt.getClaims().get(claimName);
        if (claimValue == null) {
            return;
        }
        if (claimValue instanceof Collection<?> collection) {
            for (Object item : collection) {
                if (item != null) {
                    addRole(authorities, item.toString());
                }
            }
        } else if (claimValue instanceof Object[] array) {
            for (Object item : array) {
                if (item != null) {
                    addRole(authorities, item.toString());
                }
            }
        } else if (claimValue instanceof String str) {
            String trimmed = str.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                trimmed = trimmed.substring(1, trimmed.length() - 1);
            }
            for (String part : trimmed.split("[,\\s]+")) {
                addRole(authorities, part.replace("\"", "").replace("'", "").trim());
            }
        }
    }

    private void addRole(Set<GrantedAuthority> authorities, String role) {
        if (role == null || role.isBlank()) {
            return;
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring(5);
        }
        if (ALLOWED_ROLES.contains(normalized)) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + normalized));
        }
    }
}
