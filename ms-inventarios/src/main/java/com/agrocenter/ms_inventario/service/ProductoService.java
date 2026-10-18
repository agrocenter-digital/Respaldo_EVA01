package com.agrocenter.ms_inventario.service;

import com.agrocenter.ms_inventario.dto.ProductoCreateRequest;
import com.agrocenter.ms_inventario.dto.ProductoResponse;
import com.agrocenter.ms_inventario.dto.ProductoUpdateRequest;
import com.agrocenter.ms_inventario.entity.Producto;
import com.agrocenter.ms_inventario.exception.ConflictoNegocioException;
import com.agrocenter.ms_inventario.exception.RecursoNoEncontradoException;
import com.agrocenter.ms_inventario.mapper.InventarioMapper;
import com.agrocenter.ms_inventario.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductoService {

    private final ProductoRepository productoRepository;
    private final InventarioMapper mapper;

    @Transactional(readOnly = true)
    public List<ProductoResponse> listar(String categoria, String nombre, Boolean activo) {
        String categoriaLimpia = limpiar(categoria);
        String nombreLimpio = limpiar(nombre);
        Specification<Producto> filtros = (root, query, builder) -> builder.conjunction();

        if (categoriaLimpia != null) {
            String categoriaNormalizada = categoriaLimpia.toLowerCase(Locale.ROOT);
            filtros = filtros.and((root, query, builder) -> builder.equal(
                    builder.lower(root.get("categoria")),
                    categoriaNormalizada
            ));
        }
        if (nombreLimpio != null) {
            String patronNombre = "%" + nombreLimpio.toLowerCase(Locale.ROOT) + "%";
            filtros = filtros.and((root, query, builder) -> builder.like(
                    builder.lower(root.get("nombre")),
                    patronNombre
            ));
        }
        if (activo != null) {
            filtros = filtros.and((root, query, builder) -> builder.equal(
                    root.get("activo"),
                    activo
            ));
        }

        return productoRepository.findAll(filtros, Sort.by(Sort.Direction.ASC, "nombre"))
                .stream()
                .map(mapper::toProductoResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductoResponse obtenerPorId(Long id, boolean incluirInactivos) {
        Producto producto = buscarPorId(id);
        validarVisible(producto, incluirInactivos);
        return mapper.toProductoResponse(producto);
    }

    @Transactional(readOnly = true)
    public ProductoResponse obtenerPorSku(String sku, boolean incluirInactivos) {
        Producto producto = productoRepository.findBySkuIgnoreCase(normalizarSku(sku))
                .orElseThrow(() -> new RecursoNoEncontradoException("Producto no encontrado"));
        validarVisible(producto, incluirInactivos);
        return mapper.toProductoResponse(producto);
    }

    @Transactional
    public ProductoResponse crear(ProductoCreateRequest request) {
        String sku = normalizarSku(request.sku());
        if (productoRepository.existsBySkuIgnoreCase(sku)) {
            throw new ConflictoNegocioException("Ya existe un producto con el SKU " + sku);
        }

        Producto producto = new Producto(
                sku,
                request.nombre().trim(),
                limpiar(request.descripcion()),
                request.categoria().trim(),
                request.precioVenta(),
                request.stockMinimo()
        );
        Producto creado = productoRepository.save(producto);
        log.info("Producto creado sku={} id={}", creado.getSku(), creado.getId());
        return mapper.toProductoResponse(creado);
    }

    @Transactional
    public ProductoResponse actualizar(Long id, ProductoUpdateRequest request) {
        Producto producto = buscarPorId(id);
        String sku = normalizarSku(request.sku());
        if (productoRepository.existsBySkuIgnoreCaseAndIdNot(sku, id)) {
            throw new ConflictoNegocioException("Ya existe un producto con el SKU " + sku);
        }

        producto.actualizar(
                sku,
                request.nombre().trim(),
                limpiar(request.descripcion()),
                request.categoria().trim(),
                request.precioVenta(),
                request.stockMinimo(),
                request.stockActual()
        );
        Producto actualizado = productoRepository.save(producto);
        log.info("Producto actualizado sku={} id={}", actualizado.getSku(), actualizado.getId());
        return mapper.toProductoResponse(actualizado);
    }

    @Transactional
    public ProductoResponse cambiarEstado(Long id, boolean activo) {
        Producto producto = buscarPorId(id);
        producto.cambiarEstado(activo);
        Producto actualizado = productoRepository.save(producto);
        log.info("Estado de producto actualizado sku={} activo={}", actualizado.getSku(), activo);
        return mapper.toProductoResponse(actualizado);
    }

    private Producto buscarPorId(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Producto no encontrado"));
    }

    private void validarVisible(Producto producto, boolean incluirInactivos) {
        if (!incluirInactivos && !producto.isActivo()) {
            throw new RecursoNoEncontradoException("Producto no encontrado");
        }
    }

    private String normalizarSku(String sku) {
        return sku.trim().toUpperCase(Locale.ROOT);
    }

    private String limpiar(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
