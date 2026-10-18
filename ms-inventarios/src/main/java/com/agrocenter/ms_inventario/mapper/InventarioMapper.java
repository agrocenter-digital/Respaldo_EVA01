package com.agrocenter.ms_inventario.mapper;

import com.agrocenter.ms_inventario.dto.MovimientoResponse;
import com.agrocenter.ms_inventario.dto.OperacionStockResponse;
import com.agrocenter.ms_inventario.dto.ProductoResponse;
import com.agrocenter.ms_inventario.dto.ProductoStockResponse;
import com.agrocenter.ms_inventario.entity.MovimientoInventario;
import com.agrocenter.ms_inventario.entity.Producto;
import org.springframework.stereotype.Component;

@Component
public class InventarioMapper {

    public ProductoResponse toProductoResponse(Producto producto) {
        return new ProductoResponse(
                producto.getId(),
                producto.getSku(),
                producto.getNombre(),
                producto.getDescripcion(),
                producto.getCategoria(),
                producto.getPrecioVenta(),
                producto.getStockActual(),
                producto.getStockMinimo(),
                producto.tieneStockBajo(),
                producto.isActivo(),
                producto.getCreatedAt(),
                producto.getUpdatedAt()
        );
    }

    public ProductoStockResponse toStockResponse(Producto producto) {
        return new ProductoStockResponse(
                producto.getId(),
                producto.getSku(),
                producto.getNombre(),
                producto.getStockActual(),
                producto.getStockMinimo(),
                producto.tieneStockBajo()
        );
    }

    public MovimientoResponse toMovimientoResponse(MovimientoInventario movimiento) {
        return new MovimientoResponse(
                movimiento.getId(),
                movimiento.getProducto().getId(),
                movimiento.getProducto().getSku(),
                movimiento.getTipoMovimiento(),
                movimiento.getCantidad(),
                movimiento.getStockAnterior(),
                movimiento.getStockPosterior(),
                movimiento.getReferencia(),
                movimiento.getOrigen(),
                movimiento.getFecha()
        );
    }

    public OperacionStockResponse toOperacionStockResponse(
            MovimientoInventario movimiento,
            boolean duplicada
    ) {
        return new OperacionStockResponse(
                movimiento.getId(),
                movimiento.getProducto().getId(),
                movimiento.getProducto().getSku(),
                movimiento.getTipoMovimiento(),
                movimiento.getCantidad(),
                movimiento.getStockAnterior(),
                movimiento.getStockPosterior(),
                movimiento.getReferencia(),
                duplicada,
                movimiento.getFecha()
        );
    }
}
