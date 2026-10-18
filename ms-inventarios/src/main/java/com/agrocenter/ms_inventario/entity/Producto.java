package com.agrocenter.ms_inventario.entity;

import com.agrocenter.ms_inventario.exception.ConflictoNegocioException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Entity
@Table(
        name = "productos",
        uniqueConstraints = @UniqueConstraint(name = "uk_productos_sku", columnNames = "sku")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String sku;

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(length = 500)
    private String descripcion;

    @Column(nullable = false, length = 80)
    private String categoria;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal precioVenta;

    @Column(nullable = false)
    private Integer stockActual;

    @Column(nullable = false)
    private Integer stockMinimo;

    @Column(nullable = false)
    private boolean activo;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    public Producto(
            String sku,
            String nombre,
            String descripcion,
            String categoria,
            BigDecimal precioVenta,
            Integer stockMinimo
    ) {
        this.sku = sku;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.categoria = categoria;
        this.precioVenta = precioVenta;
        this.stockActual = 0;
        this.stockMinimo = stockMinimo;
        this.activo = true;
    }

    public void actualizar(
            String sku,
            String nombre,
            String descripcion,
            String categoria,
            BigDecimal precioVenta,
            Integer stockMinimo
    ) {
        actualizar(sku, nombre, descripcion, categoria, precioVenta, stockMinimo, null);
    }

    public void actualizar(
            String sku,
            String nombre,
            String descripcion,
            String categoria,
            BigDecimal precioVenta,
            Integer stockMinimo,
            Integer stockActual
    ) {
        this.sku = sku;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.categoria = categoria;
        this.precioVenta = precioVenta;
        this.stockMinimo = stockMinimo;
        if (stockActual != null) {
            this.stockActual = stockActual;
        }
    }

    public void cambiarEstado(boolean activo) {
        this.activo = activo;
    }

    public void incrementarStock(int cantidad) {
        this.stockActual = Math.addExact(this.stockActual, cantidad);
    }

    public void descontarStock(int cantidad) {
        if (cantidad > this.stockActual) {
            throw new ConflictoNegocioException(
                    "Stock insuficiente para el producto " + this.sku
            );
        }
        this.stockActual -= cantidad;
    }

    public boolean tieneStockBajo() {
        return this.stockActual <= this.stockMinimo;
    }

    @PrePersist
    void prePersist() {
        Instant ahora = Instant.now();
        this.createdAt = ahora;
        this.updatedAt = ahora;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = Instant.now();
    }
}
