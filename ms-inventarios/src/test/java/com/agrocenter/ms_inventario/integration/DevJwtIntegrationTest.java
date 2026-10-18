package com.agrocenter.ms_inventario.integration;

import com.agrocenter.ms_inventario.repository.MovimientoInventarioRepository;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "agrocenter.security.dev.jwt-secret=clave-local-de-pruebas-con-mas-de-32-caracteres",
        "agrocenter.security.dev.issuer=http://localhost:8081/dev-issuer",
        "agrocenter.security.dev.audience=agrocenter-api",
        "agrocenter.security.dev.token-ttl-seconds=300"
})
@AutoConfigureMockMvc
@ActiveProfiles({"test", "dev"})
class DevJwtIntegrationTest {

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
    void tokenAdminLocalPermiteCrearProducto() throws Exception {
        String token = generarToken("postman-admin", "ADMIN");

        mockMvc.perform(post("/api/inventario/productos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productoJson("DEV-ADMIN")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sku").value("DEV-ADMIN"));
    }

    @Test
    void tokenClienteLocalConsultaPeroNoAdministra() throws Exception {
        String token = generarToken("postman-cliente", "CLIENTE");

        mockMvc.perform(get("/api/inventario/productos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/inventario/productos")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(productoJson("DEV-CLIENTE")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
    }

    private String generarToken(String usuario, String rol) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/dev/token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "usuario": "%s",
                                  "rol": "%s"
                                }
                                """.formatted(usuario, rol)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.rol").value(rol))
                .andReturn();

        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private String productoJson(String sku) {
        return """
                {
                  "sku": "%s",
                  "nombre": "Producto de desarrollo",
                  "descripcion": "Prueba con JWT local",
                  "categoria": "Pruebas",
                  "precioVenta": 1500.00,
                  "stockMinimo": 2
                }
                """.formatted(sku);
    }
}
