package com.agrocenter.compras.controller;

import com.agrocenter.compras.config.SecurityConfig;
import com.agrocenter.compras.dto.DetalleOrdenCompraResponse;
import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.entity.EstadoOrden;
import com.agrocenter.compras.exception.GlobalExceptionHandler;
import com.agrocenter.compras.observability.CorrelationIdFilter;
import com.agrocenter.compras.security.RestAccessDeniedHandler;
import com.agrocenter.compras.security.RestAuthenticationEntryPoint;
import com.agrocenter.compras.security.SecurityErrorWriter;
import com.agrocenter.compras.service.OrdenCompraService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(OrdenCompraController.class)
@Import({
        SecurityConfig.class,
        SecurityErrorWriter.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class,
        CorrelationIdFilter.class,
        GlobalExceptionHandler.class
})
class OrdenCompraControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrdenCompraService service;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void rechazaRutaProtegidaSinJwt() throws Exception {
        mockMvc.perform(get("/api/compras"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.correlationId").isNotEmpty())
                .andExpect(header().exists("X-Correlation-ID"));
    }

    @Test
    void clienteNoPuedeAdministrarCompras() throws Exception {
        mockMvc.perform(get("/api/compras")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CLIENTE"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void adminPuedeCrearUnaCompraConElContratoDelBff() throws Exception {
        when(service.crearOrden(any(), anyString(), anyString())).thenReturn(response());

        mockMvc.perform(post("/api/compras")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .header("X-Correlation-ID", "corr-compra-25")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "proveedorId": 7,
                                  "detalles": [
                                    {"productoId": 10, "cantidad": 2, "precioUnitario": 100.00}
                                  ]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/compras/25"))
                .andExpect(header().string("X-Correlation-ID", "corr-compra-25"))
                .andExpect(jsonPath("$.id").value(25))
                .andExpect(jsonPath("$.proveedorId").value(7))
                .andExpect(jsonPath("$.estado").value("COMPLETADA"))
                .andExpect(jsonPath("$.detalles[0].productoId").value(10));
    }

    @Test
    void validaElBodyAntesDeInvocarElServicio() throws Exception {
        mockMvc.perform(post("/api/compras")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"proveedorId\":0,\"detalles\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verify(service, never()).crearOrden(any(), anyString(), anyString());
    }

    private OrdenCompraResponse response() {
        return new OrdenCompraResponse(
                25L,
                7L,
                LocalDateTime.of(2026, 8, 29, 12, 0),
                EstadoOrden.COMPLETADA,
                new BigDecimal("200.00"),
                List.of(new DetalleOrdenCompraResponse(
                        1L,
                        10L,
                        2,
                        new BigDecimal("100.00"),
                        new BigDecimal("200.00")
                ))
        );
    }
}
