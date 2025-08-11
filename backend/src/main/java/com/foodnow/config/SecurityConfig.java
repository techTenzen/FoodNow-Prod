package com.foodnow.config;

import com.foodnow.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public static pages
                .requestMatchers(
                    "/", "/index.html", "/forgot-password.html", "/reset-password.html",
                    "/assets/**", "/uploads/**", "/forgot-password-confirmation.html",
                    "/customer/**", "/admin/**", "/restaurant/**", "/delivery/**"
                ).permitAll()

                // Swagger & documentation
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                // Actuator and error handling
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/error").permitAll()

                // Public API endpoints
                .requestMatchers("/api/auth/**", "/api/public/**").permitAll()

                // Role-based access
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/profile/**").authenticated()
                .requestMatchers("/api/restaurant/apply").hasRole("CUSTOMER")
                .requestMatchers(HttpMethod.POST, "/api/files/upload").hasAnyRole("CUSTOMER", "RESTAURANT_OWNER")
                .requestMatchers("/api/restaurant/**").hasRole("RESTAURANT_OWNER")
                .requestMatchers("/api/cart/**").hasRole("CUSTOMER")
                .requestMatchers(HttpMethod.POST, "/api/orders/{orderId}/review").hasRole("CUSTOMER")
                .requestMatchers("/api/orders/**").hasRole("CUSTOMER")
                .requestMatchers("/api/delivery/**").hasRole("DELIVERY_PERSONNEL")
                .requestMatchers("/api/manage/orders/**").hasAnyRole("ADMIN", "RESTAURANT_OWNER", "DELIVERY_PERSONNEL")

                // Everything else requires authentication
                .anyRequest().authenticated()
            );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Allow local dev and Render deployment (and all origins temporarily for testing)
        configuration.setAllowedOrigins(Arrays.asList(
            "http://localhost:4200",
            "https://foodnow-backend-jpac.onrender.com",
            "*" // ⚠️ For testing only — remove in production
        ));

        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "*"));
        
        // Allow credentials only when specific origins are used, not with "*"
        configuration.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
