package com.agrocenter.compras.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Entity
@Table(
        name = "detalles_orden_compra",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_detalle_compra_producto",
                columnNames = {"orden_compra_id", "producto_id"}
        ),
        indexes = @Index(name = "idx_detalle_compra_orden", columnList = "orden_compra_id")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DetalleOrdenCompra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_compra_id", nullable = false, updatable = false)
    private OrdenCompra ordenCompra;

    @Column(name = "producto_id", nullable = false, updatable = false)
    private Long productoId;

    @Column(nullable = false, updatable = false)
    private Integer cantidad;

    @Column(name = "precio_unitario", nullable = false, precision = 15, scale = 2, updatable = false)
    private BigDecimal precioUnitario;

    @Column(nullable = false, precision = 15, scale = 2, updatable = false)
    private BigDecimal subtotal;

    public DetalleOrdenCompra(
            Long productoId,
            Integer cantidad,
            BigDecimal precioUnitario,
            BigDecimal subtotal
    ) {
        this.productoId = productoId;
        this.cantidad = cantidad;
        this.precioUnitario = precioUnitario;
        this.subtotal = subtotal;
    }

    void asociarOrden(OrdenCompra ordenCompra) {
        this.ordenCompra = ordenCompra;
    }
}
