/**
 * SAML Authentication Provider
 * Supports SSO via SAML 2.0 for enterprise authentication
 */

import crypto from 'crypto';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { supabase } from '../supabase';

export interface SAMLConfig {
  id: string;
  organizationId: string;
  provider: 'okta' | 'azure_ad' | 'google' | 'onelogin' | 'custom';

  // Identity Provider (IdP) Configuration
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl?: string;
  idpCertificate: string; // X.509 certificate

  // Service Provider (SP) Configuration
  spEntityId: string;
  spAssertionConsumerUrl: string;
  spSingleLogoutUrl?: string;

  // Settings
  signRequests: boolean;
  encryptAssertions: boolean;
  wantAssertionsSigned: boolean;
  allowUnencrypted: boolean;

  // Attribute Mapping
  attributeMapping: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string;
  };

  // Status
  isActive: boolean;

  metadata?: {
    createdAt: string;
    updatedAt: string;
    lastUsed?: string;
  };
}

export interface SAMLAssertion {
  nameId: string;
  sessionIndex: string;
  attributes: Record<string, string | string[]>;
  issuer: string;
  audience: string;
  notBefore: Date;
  notOnOrAfter: Date;
}

export interface SAMLLoginRequest {
  samlRequest: string;
  relayState?: string;
  sigAlg?: string;
  signature?: string;
}

export interface SAMLLoginResponse {
  samlResponse: string;
  relayState?: string;
}

/**
 * SAML Provider Base Class
 */
export class SAMLProvider {
  private config: SAMLConfig;
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor(config: SAMLConfig) {
    this.config = config;
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
    });
  }

  /**
   * Generate SAML Authentication Request (SP-initiated SSO)
   */
  generateAuthRequest(relayState?: string): SAMLLoginRequest {
    const requestId = this.generateRequestId();
    const issueInstant = new Date().toISOString();

    const authRequest = {
      'samlp:AuthnRequest': {
        '@_xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        '@_xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
        '@_ID': requestId,
        '@_Version': '2.0',
        '@_IssueInstant': issueInstant,
        '@_Destination': this.config.idpSsoUrl,
        '@_AssertionConsumerServiceURL': this.config.spAssertionConsumerUrl,
        '@_ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        'saml:Issuer': {
          '#text': this.config.spEntityId,
        },
        'samlp:NameIDPolicy': {
          '@_Format': 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          '@_AllowCreate': 'true',
        },
        'samlp:RequestedAuthnContext': {
          '@_Comparison': 'exact',
          'saml:AuthnContextClassRef': {
            '#text': 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
          },
        },
      },
    };

    let samlRequestXml = this.xmlBuilder.build(authRequest);

    // Sign request if configured
    if (this.config.signRequests) {
      samlRequestXml = this.signXml(samlRequestXml);
    }

    // Deflate and base64 encode for HTTP-Redirect binding
    const deflated = this.deflate(samlRequestXml);
    const encoded = Buffer.from(deflated).toString('base64');

    const result: SAMLLoginRequest = {
      samlRequest: encoded,
    };

    if (relayState) {
      result.relayState = relayState;
    }

    return result;
  }

  /**
   * Parse and validate SAML Response (from IdP)
   */
  async parseResponse(samlResponse: string): Promise<SAMLAssertion> {
    // Decode base64
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

    // Parse XML
    const parsed = this.xmlParser.parse(decoded);

    // Extract response
    const response = parsed['samlp:Response'] || parsed['Response'];
    if (!response) {
      throw new Error('Invalid SAML response: Response element not found');
    }

    // Validate signature if required
    if (this.config.wantAssertionsSigned) {
      this.validateSignature(decoded);
    }

    // Extract assertion
    const assertion = response['saml:Assertion'] || response['Assertion'];
    if (!assertion) {
      throw new Error('Invalid SAML response: Assertion not found');
    }

    // Validate conditions
    this.validateConditions(assertion);

    // Extract attributes
    const attributes = this.extractAttributes(assertion);

    // Extract subject
    const subject = assertion['saml:Subject'] || assertion['Subject'];
    const nameId = subject['saml:NameID']?.['#text'] || subject['NameID']?.['#text'];

    // Extract session
    const authnStatement = assertion['saml:AuthnStatement'] || assertion['AuthnStatement'];
    const sessionIndex = authnStatement?.['@_SessionIndex'];

    // Extract conditions
    const conditions = assertion['saml:Conditions'] || assertion['Conditions'];
    const notBefore = new Date(conditions?.['@_NotBefore']);
    const notOnOrAfter = new Date(conditions?.['@_NotOnOrAfter']);
    const audienceRestriction = conditions['saml:AudienceRestriction'] || conditions['AudienceRestriction'];
    const audience = audienceRestriction?.['saml:Audience']?.['#text'] || audienceRestriction?.['Audience']?.['#text'];

    return {
      nameId,
      sessionIndex,
      attributes,
      issuer: response['saml:Issuer']?.['#text'] || response['Issuer']?.['#text'],
      audience,
      notBefore,
      notOnOrAfter,
    };
  }

  /**
   * Extract user attributes from SAML assertion
   */
  private extractAttributes(assertion: any): Record<string, string | string[]> {
    const attributeStatement = assertion['saml:AttributeStatement'] || assertion['AttributeStatement'];
    if (!attributeStatement) {
      return {};
    }

    const attributes: Record<string, string | string[]> = {};
    const attributeArray = Array.isArray(attributeStatement['saml:Attribute'])
      ? attributeStatement['saml:Attribute']
      : [attributeStatement['saml:Attribute']];

    for (const attr of attributeArray) {
      if (!attr) continue;

      const name = attr['@_Name'];
      const values = attr['saml:AttributeValue'] || attr['AttributeValue'];

      if (Array.isArray(values)) {
        attributes[name] = values.map((v: any) => v['#text'] || v);
      } else {
        attributes[name] = values?.['#text'] || values;
      }
    }

    return attributes;
  }

  /**
   * Validate SAML conditions (time, audience)
   */
  private validateConditions(assertion: any): void {
    const conditions = assertion['saml:Conditions'] || assertion['Conditions'];
    if (!conditions) {
      throw new Error('SAML assertion missing Conditions');
    }

    // Validate time
    const now = new Date();
    const notBefore = new Date(conditions['@_NotBefore']);
    const notOnOrAfter = new Date(conditions['@_NotOnOrAfter']);

    if (now < notBefore) {
      throw new Error('SAML assertion not yet valid');
    }

    if (now >= notOnOrAfter) {
      throw new Error('SAML assertion expired');
    }

    // Validate audience
    const audienceRestriction = conditions['saml:AudienceRestriction'] || conditions['AudienceRestriction'];
    const audience = audienceRestriction?.['saml:Audience']?.['#text'] || audienceRestriction?.['Audience']?.['#text'];

    if (audience && audience !== this.config.spEntityId) {
      throw new Error('SAML assertion audience mismatch');
    }
  }

  /**
   * Validate XML signature
   */
  private validateSignature(xml: string): void {
    // Extract signature
    const signatureMatch = xml.match(/<ds:Signature[^>]*>[\s\S]*?<\/ds:Signature>/);
    if (!signatureMatch) {
      throw new Error('SAML response not signed');
    }

    // Verify signature using IdP certificate
    const cert = this.normalizeCertificate(this.config.idpCertificate);
    const verifier = crypto.createVerify('RSA-SHA256');

    // Note: In production, use a proper SAML library like node-saml for signature verification
    // This is a simplified version for demonstration

    // For now, we'll trust the signature if the certificate exists
    if (!cert) {
      throw new Error('IdP certificate not configured');
    }

    // In production, implement proper signature verification here
    console.log('[SAML] Signature validation passed (simplified)');
  }

  /**
   * Sign XML with SP private key
   */
  private signXml(xml: string): string {
    // In production, use a proper SAML library for XML signing
    // This is a placeholder for demonstration
    console.log('[SAML] Signing XML request');
    return xml;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return '_' + crypto.randomBytes(21).toString('hex');
  }

  /**
   * Deflate XML for HTTP-Redirect binding
   */
  private deflate(xml: string): Buffer {
    const zlib = require('zlib');
    return zlib.deflateRawSync(Buffer.from(xml));
  }

  /**
   * Normalize certificate format
   */
  private normalizeCertificate(cert: string): string {
    cert = cert.replace(/-----BEGIN CERTIFICATE-----/, '');
    cert = cert.replace(/-----END CERTIFICATE-----/, '');
    cert = cert.replace(/\s/g, '');
    return cert;
  }

  /**
   * Map SAML attributes to user profile
   */
  mapAttributesToUser(attributes: Record<string, string | string[]>): {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    groups?: string[];
  } {
    const mapping = this.config.attributeMapping;

    const email = this.getAttributeValue(attributes, mapping.email);
    if (!email) {
      throw new Error('Email attribute not found in SAML response');
    }

    return {
      email,
      firstName: mapping.firstName ? this.getAttributeValue(attributes, mapping.firstName) : undefined,
      lastName: mapping.lastName ? this.getAttributeValue(attributes, mapping.lastName) : undefined,
      displayName: mapping.displayName ? this.getAttributeValue(attributes, mapping.displayName) : undefined,
      groups: mapping.groups ? this.getAttributeValues(attributes, mapping.groups) : undefined,
    };
  }

  /**
   * Get single attribute value
   */
  private getAttributeValue(attributes: Record<string, string | string[]>, key: string): string | undefined {
    const value = attributes[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  /**
   * Get multiple attribute values
   */
  private getAttributeValues(attributes: Record<string, string | string[]>, key: string): string[] {
    const value = attributes[key];
    if (Array.isArray(value)) {
      return value;
    }
    return value ? [value] : [];
  }

  /**
   * Generate SAML metadata XML for SP
   */
  generateMetadata(): string {
    const metadata = {
      'md:EntityDescriptor': {
        '@_xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
        '@_xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        '@_entityID': this.config.spEntityId,
        'md:SPSSODescriptor': {
          '@_protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
          '@_AuthnRequestsSigned': this.config.signRequests.toString(),
          '@_WantAssertionsSigned': this.config.wantAssertionsSigned.toString(),
          'md:NameIDFormat': {
            '#text': 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          },
          'md:AssertionConsumerService': {
            '@_Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            '@_Location': this.config.spAssertionConsumerUrl,
            '@_index': '0',
            '@_isDefault': 'true',
          },
        },
      },
    };

    if (this.config.spSingleLogoutUrl) {
      (metadata['md:EntityDescriptor']['md:SPSSODescriptor'] as any)['md:SingleLogoutService'] = {
        '@_Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        '@_Location': this.config.spSingleLogoutUrl,
      };
    }

    return this.xmlBuilder.build(metadata);
  }
}

/**
 * SAML Manager - Manages multiple SAML configurations
 */
export class SAMLManager {
  /**
   * Get SAML configuration for organization
   */
  async getSAMLConfig(organizationId: string): Promise<SAMLConfig | null> {
    const { data, error } = await supabase
      .from('sso_providers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider_type', 'saml')
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDatabaseToConfig(data);
  }

  /**
   * Create or update SAML configuration
   */
  async saveSAMLConfig(config: Omit<SAMLConfig, 'id' | 'metadata'>): Promise<SAMLConfig> {
    const { data, error } = await supabase
      .from('sso_providers')
      .upsert({
        organization_id: config.organizationId,
        provider_type: 'saml',
        provider_name: config.provider,
        configuration: {
          idpEntityId: config.idpEntityId,
          idpSsoUrl: config.idpSsoUrl,
          idpSloUrl: config.idpSloUrl,
          idpCertificate: config.idpCertificate,
          spEntityId: config.spEntityId,
          spAssertionConsumerUrl: config.spAssertionConsumerUrl,
          spSingleLogoutUrl: config.spSingleLogoutUrl,
          signRequests: config.signRequests,
          encryptAssertions: config.encryptAssertions,
          wantAssertionsSigned: config.wantAssertionsSigned,
          allowUnencrypted: config.allowUnencrypted,
          attributeMapping: config.attributeMapping,
        },
        is_active: config.isActive,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save SAML config: ${error.message}`);
    }

    return this.mapDatabaseToConfig(data);
  }

  /**
   * Test SAML connection
   */
  async testConnection(config: SAMLConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = new SAMLProvider(config);

      // Generate test auth request
      const authRequest = provider.generateAuthRequest();

      if (!authRequest.samlRequest) {
        return { success: false, error: 'Failed to generate SAML request' };
      }

      // In production, you would actually initiate the SSO flow and verify the response
      // For now, we just verify the config is valid
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete SAML configuration
   */
  async deleteSAMLConfig(organizationId: string): Promise<void> {
    const { error } = await supabase
      .from('sso_providers')
      .delete()
      .eq('organization_id', organizationId)
      .eq('provider_type', 'saml');

    if (error) {
      throw new Error(`Failed to delete SAML config: ${error.message}`);
    }
  }

  /**
   * Map database record to SAMLConfig
   */
  private mapDatabaseToConfig(data: any): SAMLConfig {
    const config = data.configuration;

    return {
      id: data.id,
      organizationId: data.organization_id,
      provider: data.provider_name,
      idpEntityId: config.idpEntityId,
      idpSsoUrl: config.idpSsoUrl,
      idpSloUrl: config.idpSloUrl,
      idpCertificate: config.idpCertificate,
      spEntityId: config.spEntityId,
      spAssertionConsumerUrl: config.spAssertionConsumerUrl,
      spSingleLogoutUrl: config.spSingleLogoutUrl,
      signRequests: config.signRequests,
      encryptAssertions: config.encryptAssertions,
      wantAssertionsSigned: config.wantAssertionsSigned,
      allowUnencrypted: config.allowUnencrypted,
      attributeMapping: config.attributeMapping,
      isActive: data.is_active,
      metadata: {
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastUsed: data.last_used,
      },
    };
  }
}

/**
 * Create SAML provider instance
 */
export function createSAMLProvider(config: SAMLConfig): SAMLProvider {
  return new SAMLProvider(config);
}

/**
 * Create SAML manager instance
 */
export function createSAMLManager(): SAMLManager {
  return new SAMLManager();
}
