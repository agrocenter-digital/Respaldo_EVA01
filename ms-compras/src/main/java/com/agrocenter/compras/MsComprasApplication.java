package com.agrocenter.compras;

import com.agrocenter.compras.config.InventoryProperties;
import com.agrocenter.compras.config.JwtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({InventoryProperties.class, JwtProperties.class})
public class MsComprasApplication {

    public static void main(String[] args) {
        SpringApplication.run(MsComprasApplication.class, args);
    }

}
