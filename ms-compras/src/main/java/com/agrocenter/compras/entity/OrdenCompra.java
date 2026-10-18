package com.agrocenter.compras.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Getter
@Entity
@Table(
        name = "ordenes_compra",
        indexes = {
                @Index(name = "idx_ordenes_compra_proveedor", columnList = "proveedor_id"),
                @Index(name = "idx_ordenes_compra_estado", columnList = "estado"),
                @Index(name = "idx_ordenes_compra_fecha", columnList = "fecha_creacion")
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrdenCompra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "proveedor_id", nullable = false, updatable = false)
    private Long proveedorId;

    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoOrden estado;

    @Column(nullable = false, precision = 15, scale = 2, updatable = false)
    private BigDecimal total;

    @Column(name = "motivo_cancelacion", length = 500)
    private String motivoCancelacion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(
            mappedBy = "ordenCompra",
            fetch = FetchType.LAZY,
            cascade = {CascadeType.PERSIST, CascadeType.MERGE},
            orphanRemoval = true
    )
    @OrderBy("id ASC")
    private List<DetalleOrdenCompra> detalles = new ArrayList<>();

    public OrdenCompra(Long proveedorId, BigDecimal total) {
        this.proveedorId = proveedorId;
        this.total = total;
        this.estado = EstadoOrden.PENDIENTE;
    }

    public void agregarDetalle(DetalleOrdenCompra detalle) {
        detalle.asociarOrden(this);
        this.detalles.add(detalle);
    }

    public List<DetalleOrdenCompra> getDetalles() {
        return Collections.unmodifiableList(detalles);
    }

    public void completar() {
        if (estado != EstadoOrden.PENDIENTE) {
            throw new IllegalStateException("Solo una orden pendiente puede completarse");
        }
        this.estado = EstadoOrden.COMPLETADA;
        this.motivoCancelacion = null;
    }

    public void cancelar(String motivo) {
        if (estado != EstadoOrden.PENDIENTE) {
            throw new IllegalStateException("Solo una orden pendiente puede cancelarse");
        }
        this.estado = EstadoOrden.CANCELADA;
        this.motivoCancelacion = motivo;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime ahora = LocalDateTime.now(ZoneOffset.UTC);
        this.fechaCreacion = ahora;
        this.createdAt = ahora;
        this.updatedAt = ahora;
    }

    @PreUpdate
    void preUpdate() {
        this.updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
