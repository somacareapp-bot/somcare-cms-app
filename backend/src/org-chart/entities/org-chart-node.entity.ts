import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum NodeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('org_chart_nodes')
export class OrgChartNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  subtitle: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  location: string;

  @Column({ default: 0 })
  headcount: number;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'enum', enum: NodeStatus, default: NodeStatus.ACTIVE })
  status: NodeStatus;

  @Column({ nullable: true })
  parentId: string;

  // Link this box to real staff: 'role' (role id), 'department' (department id)
  // or 'position' (text match). Null = not linked.
  @Column({ type: 'varchar', nullable: true })
  linkType: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkValue: string | null;

  // The real user who occupies this box. Drives expense approval routing:
  // staff below this box in the tree send their expenses to this person.
  @Column({ type: 'varchar', name: 'linked_user_id', nullable: true })
  linkedUserId: string | null;

  @ManyToOne(() => OrgChartNode, (node) => node.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentId' })
  parent: OrgChartNode;

  @OneToMany(() => OrgChartNode, (node) => node.parent)
  children: OrgChartNode[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
