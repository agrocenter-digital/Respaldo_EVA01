package com.agrocenter.compras.mapper;

import com.agrocenter.compras.dto.DetalleOrdenCompraResponse;
import com.agrocenter.compras.dto.OrdenCompraResponse;
import com.agrocenter.compras.entity.DetalleOrdenCompra;
import com.agrocenter.compras.entity.OrdenCompra;
import org.springframework.stereotype.Component;

@Component
public class OrdenCompraMapper {

    public OrdenCompraResponse toResponse(OrdenCompra orden) {
        return new OrdenCompraResponse(
                orden.getId(),
                orden.getProveedorId(),
                orden.getFechaCreacion(),
                orden.getEstado(),
                orden.getTotal(),
                orden.getDetalles().stream().map(this::toDetalleResponse).toList()
        );
    }

    private DetalleOrdenCompraResponse toDetalleResponse(DetalleOrdenCompra detalle) {
        return new DetalleOrdenCompraResponse(
                detalle.getId(),
                detalle.getProductoId(),
                detalle.getCantidad(),
                detalle.getPrecioUnitario(),
                detalle.getSubtotal()
        );
    }
}
