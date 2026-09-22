package com.elasticemail.springboot;

import com.elasticemail.client.ApiClient;
import com.elasticemail.client.Configuration;
import com.elasticemail.client.auth.ApiKeyAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;

@org.springframework.context.annotation.Configuration
public class ElasticEmailConfig {

    @Value("${ELASTICEMAIL_API_KEY:}")
    private String apiKey;

    @Bean
    public ApiClient apiClient() {
        if (apiKey == null || apiKey.isEmpty()) {
            throw new IllegalStateException("ELASTICEMAIL_API_KEY environment variable is required");
        }
        ApiClient client = Configuration.getDefaultApiClient();
        ApiKeyAuth apikey = (ApiKeyAuth) client.getAuthentication("apikey");
        apikey.setApiKey(apiKey);
        return client;
    }
}
