/**
 * Directive system type definitions
 */

export type ConflictSeverity = 'error' | 'warning';

export type ConflictType =
    | 'exclusive'
    | 'missing-dependency'
    | 'category-limit'
    | 'mutual-exclusive-group'
    | 'soft-conflict'
    | 'deprecated';

export interface ConflictIssue {
    type: ConflictType;
    severity: ConflictSeverity;
    message: string;
    promptIdentifier: string;
    promptName: string;
    conflictingPromptIdentifier?: string;
    conflictingPromptName?: string;
    customMessage?: string;
}

export interface DirectiveMetadata {
    // Organization
    tags?: string[];
    group?: string;
    groupDescription?: string;
    priority?: number;

    // Visual
    icon?: string;
    color?: string;
    badge?: string;
    highlight?: boolean;

    // Conflicts
    exclusiveWith?: string[];
    requires?: string[];
    conflictsWith?: string[];
    mutualExclusiveGroup?: string;

    // Visibility
    hidden?: boolean;
    defaultEnabled?: boolean;
    ifEnabled?: string[];
    ifDisabled?: string[];

    // Documentation
    tooltip?: string;
    help?: string;
    documentationUrl?: string;
    example?: string;
    deprecated?: boolean;
    deprecatedMessage?: string;

    // Performance
    tokenCost?: number;
    tokenCostWarn?: number;
    performanceImpact?: 'low' | 'medium' | 'high';
}

export interface DirectiveDefinition {
    name: string;
    description: string;
    syntax: string;
    example?: string;
    category: DirectiveCategory;
}

export type DirectiveCategory =
    | 'organization'
    | 'conflicts'
    | 'visibility'
    | 'documentation'
    | 'performance'
    | 'triggers';

export const DIRECTIVE_CATEGORIES: Record<DirectiveCategory, string> = {
    organization: 'Organization & Metadata',
    conflicts: 'Conflict Management',
    visibility: 'Visibility & Conditionals',
    documentation: 'Documentation & Help',
    performance: 'Performance & Optimization',
    triggers: 'Message-Based Triggers',
};
