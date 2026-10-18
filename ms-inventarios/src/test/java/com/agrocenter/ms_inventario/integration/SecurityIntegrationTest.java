package com.agrocenter.ms_inventario.integration;

import com.agrocenter.ms_inventario.entity.Producto;
import com.agrocenter.ms_inventario.repository.MovimientoInventarioRepository;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MovimientoInventarioRepository movimientoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @BeforeEach
    void limpiarDatos() {
        movimientoRepository.deleteAll();
        productoRepository.deleteAll();
    }

    @Test
    void permiteHealthCheckSinJwt() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    void noExponeEmisorLocalFueraDelPerfilDev() throws Exception {
        mockMvc.perform(post("/api/dev/token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"usuario\":\"intruso\",\"rol\":\"ADMIN\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void permiteConsultarCatalogoSinJwt() throws Exception {
        mockMvc.perform(get("/api/inventario/productos"))
                .andExpect(status().isOk());
    }

    @Test
    void rechazaAccesoSinJwt() throws Exception {
        mockMvc.perform(get("/api/inventario/movimientos"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    void clientePuedeConsultarCatalogo() throws Exception {
        mockMvc.perform(get("/api/inventario/productos")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CLIENTE"))))
                .andExpect(status().isOk());
    }

    @Test
    void clienteNoPuedeCrearProductos() throws Exception {
        mockMvc.perform(post("/api/inventario/productos")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CLIENTE")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productoJson("SEG-CLIENTE")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
    }

    @Test
    void adminPuedeCrearProductos() throws Exception {
        mockMvc.perform(post("/api/inventario/productos")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productoJson("SEG-ADMIN")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sku").value("SEG-ADMIN"));
    }

    @Test
    void permiteConsultarProductoSinJwtSinNullPointerException() throws Exception {
        Producto producto = new Producto(
                "PUB-001",
                "Producto Publico",
                "Descripcion publica",
                "General",
                new BigDecimal("2500.00"),
                5
        );
        producto.incrementarStock(50);
        producto = productoRepository.save(producto);

        // GET /api/inventario/productos sin JWT
        mockMvc.perform(get("/api/inventario/productos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sku").value("PUB-001"));

        // GET /api/inventario/productos/{id} sin JWT (prueba authentication null en esAdmin)
        mockMvc.perform(get("/api/inventario/productos/" + producto.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Producto Publico"));

        // GET /api/inventario/productos/sku/{sku} sin JWT
        mockMvc.perform(get("/api/inventario/productos/sku/PUB-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(producto.getId()));

        // GET /api/inventario/productos/{id}/stock sin JWT
        mockMvc.perform(get("/api/inventario/productos/" + producto.getId() + "/stock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockActual").value(50));
    }

    private String productoJson(String sku) {
        return """
                {
                  "sku": "%s",
                  "nombre": "Producto de seguridad",
                  "descripcion": "Prueba de autorizacion",
                  "categoria": "Pruebas",
                  "precioVenta": 1000.00,
                  "stockMinimo": 2
                }
                """.formatted(sku);
    }
}
