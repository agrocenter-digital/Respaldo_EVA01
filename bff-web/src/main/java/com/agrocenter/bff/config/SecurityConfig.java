package com.agrocenter.bff.config;

import com.agrocenter.bff.security.CognitoAuthoritiesConverter;
import com.agrocenter.bff.security.RestAccessDeniedHandler;
import com.agrocenter.bff.security.RestAuthenticationEntryPoint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            RestAuthenticationEntryPoint authenticationEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler,
            JwtAuthenticationConverter jwtAuthenticationConverter,
            CorsConfigurationSource corsConfigurationSource
    ) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Sonda de salud de AWS ALB (debe ser pública para evitar bucles de reinicio en ECS)
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/info",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/error"
                        ).permitAll()

                        // Catálogo público (solo lectura GET para clientes anónimos)
                        .requestMatchers(HttpMethod.GET, "/api/bff/catalogo", "/api/bff/catalogo/**").permitAll()

                        // Preflights de CORS para el navegador
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Rutas de mutación de inventario (permite por rol administrativo o scope write)
                        .requestMatchers(HttpMethod.POST, "/api/bff/inventario/**", "/api/bff/admin/inventario/**")
                                .hasAnyAuthority("ROLE_ADMIN", "ADMIN", "SCOPE_inventario.stock.write")
                        .requestMatchers(HttpMethod.PUT, "/api/bff/inventario/**", "/api/bff/admin/inventario/**")
                                .hasAnyAuthority("ROLE_ADMIN", "ADMIN", "SCOPE_inventario.stock.write")
                        .requestMatchers(HttpMethod.PATCH, "/api/bff/inventario/**", "/api/bff/admin/inventario/**")
                                .hasAnyAuthority("ROLE_ADMIN", "ADMIN", "SCOPE_inventario.stock.write")
                        .requestMatchers(HttpMethod.DELETE, "/api/bff/inventario/**", "/api/bff/admin/inventario/**")
                                .hasAnyAuthority("ROLE_ADMIN", "ADMIN", "SCOPE_inventario.stock.write")

                        // Rutas administrativas generales
                        .requestMatchers("/api/bff/admin/**", "/api/bff/inventario/**", "/api/bff/compras/**")
                                .hasAnyAuthority("ROLE_ADMIN", "ADMIN", "SCOPE_inventario.stock.read", "SCOPE_inventario.stock.write")

                        // Todo lo demás exige autenticación
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter))
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                );
        return http.build();
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new CognitoAuthoritiesConverter());
        return converter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();

        List<String> patterns = new ArrayList<>();
        if (properties.allowedOriginPatterns() != null && !properties.allowedOriginPatterns().isEmpty()) {
            patterns.addAll(properties.allowedOriginPatterns());
        }
        if (properties.allowedOrigins() != null && !properties.allowedOrigins().isEmpty()) {
            patterns.addAll(properties.allowedOrigins());
        }
        if (patterns.isEmpty()) {
            patterns = List.of(
                    "https://front-web-seven.vercel.app",
                    "https://*.vercel.app",
                    "http://localhost:3000",
                    "http://localhost:5173"
            );
        }
        configuration.setAllowedOriginPatterns(patterns);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of(
                HttpHeaders.AUTHORIZATION,
                HttpHeaders.CONTENT_TYPE,
                HttpHeaders.ACCEPT,
                HttpHeaders.ORIGIN,
                "X-Requested-With",
                "Idempotency-Key",
                "X-Correlation-ID"
        ));
        configuration.setExposedHeaders(List.of(
                HttpHeaders.AUTHORIZATION,
                HttpHeaders.LOCATION,
                "Idempotent-Replay",
                "X-Correlation-ID"
        ));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
