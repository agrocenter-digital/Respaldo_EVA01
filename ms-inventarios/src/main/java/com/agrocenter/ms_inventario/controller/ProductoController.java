package com.agrocenter.ms_inventario.controller;

import com.agrocenter.ms_inventario.dto.ProductoCreateRequest;
import com.agrocenter.ms_inventario.dto.ProductoEstadoRequest;
import com.agrocenter.ms_inventario.dto.ProductoResponse;
import com.agrocenter.ms_inventario.dto.ProductoStockResponse;
import com.agrocenter.ms_inventario.dto.ProductoUpdateRequest;
import com.agrocenter.ms_inventario.service.InventarioService;
import com.agrocenter.ms_inventario.service.ProductoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/inventario/productos", "/productos", "/api/inventario/productos/", "/productos/"})
@Tag(name = "Productos", description = "Catalogo y administracion de productos")
public class ProductoController {

    private final ProductoService productoService;
    private final InventarioService inventarioService;

    @GetMapping
    @Operation(summary = "Listar productos con filtros opcionales")
    public List<ProductoResponse> listar(
            @RequestParam(required = false) @Size(max = 80) String categoria,
            @RequestParam(required = false) @Size(max = 120) String nombre,
            @RequestParam(required = false) Boolean activo,
            Authentication authentication
    ) {
        Boolean activoEfectivo = esAdmin(authentication) ? activo : Boolean.TRUE;
        return productoService.listar(categoria, nombre, activoEfectivo);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener un producto por identificador")
    public ProductoResponse obtener(@PathVariable Long id, Authentication authentication) {
        return productoService.obtenerPorId(id, esAdmin(authentication));
    }

    @GetMapping("/sku/{sku}")
    @Operation(summary = "Obtener un producto por SKU")
    public ProductoResponse obtenerPorSku(
            @PathVariable @Size(max = 50) String sku,
            Authentication authentication
    ) {
        return productoService.obtenerPorSku(sku, esAdmin(authentication));
    }

    @GetMapping("/{id}/stock")
    @Operation(summary = "Consultar el stock actual y el umbral minimo")
    public ProductoStockResponse consultarStock(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return inventarioService.consultarStock(id, esAdmin(authentication));
    }

    @PostMapping
    @Operation(summary = "Crear un producto", description = "Requiere rol ADMIN")
    public ResponseEntity<ProductoResponse> crear(@Valid @RequestBody ProductoCreateRequest request) {
        ProductoResponse creado = productoService.crear(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(creado.id())
                .toUri();
        return ResponseEntity.created(location).body(creado);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar un producto", description = "Requiere rol ADMIN")
    public ProductoResponse actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProductoUpdateRequest request
    ) {
        return productoService.actualizar(id, request);
    }

    @PatchMapping("/{id}/estado")
    @Operation(summary = "Activar o desactivar un producto", description = "Requiere rol ADMIN")
    public ProductoResponse cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody ProductoEstadoRequest request
    ) {
        return productoService.cambiarEstado(id, request.activo());
    }

    private boolean esAdmin(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
    }
}
