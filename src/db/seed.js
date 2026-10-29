const { getDatabase } = require('./index');
const { hashPassword } = require('../utils/crypto');
const { createCourse } = require('../services/courseService');
const { createClass, enrollStudent, assignAssessmentToClass } = require('../services/classService');
const { createStudent } = require('../services/studentService');
const { createQuestion } = require('../services/questionService');
const { createPool, addQuestionToPool } = require('../services/poolService');
const { createAssessment, addQuestionToAssessment, addPoolToAssessment } = require('../services/assessmentService');

function seedDatabase(dbPath = null) {
  const db = getDatabase(dbPath);

  // Check if already seeded
  const existingAdmin = db.get("SELECT id FROM users WHERE username = 'admin'");
  if (existingAdmin) {
    // Ensure demo instructor exists on previously seeded databases
    const existingInst = db.get("SELECT id FROM users WHERE username = 'evelyn.reed'");
    if (!existingInst) {
      const instId = 'usr_inst_001';
      db.run(
        `INSERT INTO users (id, username, email, password_hash, role, first_name, surname, account_status, must_change_password, created_at)
         VALUES (?, 'evelyn.reed', 'evelyn.reed@eduqe.com', ?, 'instructor', 'Dr. Evelyn', 'Reed', 'active', 0, datetime('now'))`,
        [instId, hashPassword('Eduqe2026!')]
      );
      db.run(
        `UPDATE classes SET instructor_id = ? WHERE name = 'November Morning Class' AND instructor_id IS NULL`,
        [instId]
      );
      console.log('Ensured demonstration instructor (evelyn.reed) is seeded and allocated.');
    }

    // Ensure every existing class has an active class-level access code
    const allClasses = db.all('SELECT cl.*, c.code as course_code FROM classes cl JOIN courses c ON c.id = cl.course_id ORDER BY cl.created_at ASC');
    for (const cls of allClasses) {
      const existingClassCode = db.get('SELECT * FROM course_access_codes WHERE class_id = ? AND is_active = 1', [cls.id]);
      if (!existingClassCode) {
        const unassignedCourseCode = db.get('SELECT * FROM course_access_codes WHERE course_id = ? AND class_id IS NULL AND is_active = 1 ORDER BY created_at ASC LIMIT 1', [cls.course_id]);
        if (unassignedCourseCode) {
          db.run('UPDATE course_access_codes SET class_id = ? WHERE id = ?', [cls.id, unassignedCourseCode.id]);
        } else {
          const { createCode } = require('../services/accessCodeService');
          const { generateRandomCode } = require('../utils/crypto');
          const defaultCode = cls.name === 'Weekend Class' ? 'AZ104-WEEKEND-01' : generateRandomCode(cls.course_code || 'CLS', 4);
          try {
            createCode({
              courseId: cls.course_id,
              classId: cls.id,
              code: defaultCode
            });
          } catch (e) {
            // Ignore if duplicate
          }
        }
      }
    }

    // Ensure existing assessments have 3 default sections and map legacy demo sections to Section 1 / 2 / 3
    db.run(`UPDATE assessments SET sections = '["Section 1","Section 2","Section 3"]' WHERE sections IS NULL OR sections = ''`);
    db.run(`UPDATE assessment_questions SET section_name = 'Section 1' WHERE section_name IN ('General', 'Fundamentals', 'Storage Redundancy')`);
    db.run(`UPDATE assessment_questions SET section_name = 'Section 2' WHERE section_name IN ('Governance', 'Identity & Access', 'Management Tools')`);
    db.run(`UPDATE assessment_questions SET section_name = 'Section 3' WHERE section_name IN ('Virtual Networking', 'Architecture Case Studies')`);

    // Ensure demonstration Hotspot question exists in Question Bank
    const existingHotspot = db.get("SELECT id FROM questions WHERE question_type = 'hotspot'");
    if (!existingHotspot) {
      const azCourse = db.get("SELECT id FROM courses ORDER BY created_at ASC LIMIT 1");
      if (azCourse) {
        createQuestion({
          course_id: azCourse.id,
          topic: 'Cloud Models & Architecture',
          learning_objective: 'Understand Cloud Computing Models',
          difficulty: 'medium',
          tags: ['Hotspot', 'CloudModels', 'HybridCloud', 'PublicCloud'],
          question_type: 'hotspot',
          question_text: 'For each of the following statements, select Yes if the statement is true. Otherwise, select No.',
          question_description: 'NOTE: Each correct selection is worth one point.\nHot Area:\nAnswer Area',
          points: 3,
          partial_credit: true,
          answer_options: [
            { id: 'stmt_1', statement: 'To achieve a hybrid cloud model, a company must always migrate from a private cloud model.', options: ['Yes', 'No'] },
            { id: 'stmt_2', statement: 'A company can extend the capacity of its internal network by using the public cloud.', options: ['Yes', 'No'] },
            { id: 'stmt_3', statement: 'In a public cloud model, only guest users at your company can access the resources in the cloud.', options: ['Yes', 'No'] }
          ],
          correct_answer: {
            stmt_1: 'No',
            stmt_2: 'Yes',
            stmt_3: 'No'
          },
          answer_explanation: 'Statement 1: A company can adopt a hybrid cloud model directly without migrating from an existing private cloud. Statement 2: Public cloud can extend on-premises network and compute capacity. Statement 3: In a public cloud model, authorized corporate users, administrators, and services can access resources, not just guest users.',
          status: 'published',
          adminUserId: existingAdmin.id
        });
        console.log('Seeded demonstration Hotspot question into Question Bank.');
      }
    }

    // Ensure demonstration Microsoft DRAG DROP question exists in Question Bank
    const existingDragDrop = db.get("SELECT id FROM questions WHERE question_type = 'matching' AND question_text LIKE '%Azure storage services%'");
    if (!existingDragDrop) {
      const azCourse = db.get("SELECT id FROM courses ORDER BY created_at ASC LIMIT 1");
      if (azCourse) {
        createQuestion({
          course_id: azCourse.id,
          topic: 'Storage Accounts',
          learning_objective: 'Configure Azure Storage Services and Access Tiers',
          difficulty: 'medium',
          tags: ['Matching', 'Drag-and-Drop', 'Storage', 'Azure Blob', 'Azure Files'],
          question_type: 'matching',
          question_text: 'Match the Azure storage services to the appropriate descriptions.',
          question_description: 'To answer, drag the appropriate storage service from the column on the left to its description on the right. Each service may be used once, more than once, or not at all.\n\nNOTE: Each correct match is worth one point.',
          answer_options: {
            source_title: 'Storage service',
            target_title: 'Answer Area',
            sources: [
              { id: 'src_blob', text: 'Azure Blob storage' },
              { id: 'src_disk', text: 'Azure Disk storage' },
              { id: 'src_files', text: 'Azure Files' },
              { id: 'src_queue', text: 'Azure Queue Storage' }
            ],
            targets: [
              { id: 'tgt_msg', text: 'Used for reliable messaging between applications' },
              { id: 'tgt_share', text: 'Can be accessed as a network share from a Windows device' },
              { id: 'tgt_archive', text: 'Can be configured to use the Archive access tier' }
            ]
          },
          correct_answer: {
            tgt_msg: 'src_queue',
            tgt_share: 'src_files',
            tgt_archive: 'src_blob'
          },
          answer_explanation: 'Azure Queue Storage is designed for asynchronous, reliable message queues between application components. Azure Files provides serverless SMB/NFS file shares mounted directly on Windows, macOS, or Linux. Azure Blob storage supports the Archive access tier for low-cost offline data storage. Azure Disk storage is persistent block storage attached to virtual machines.',
          points: 3,
          partial_credit: true,
          status: 'published',
          adminUserId: existingAdmin.id
        });
        console.log('Seeded demonstration Microsoft DRAG DROP question into Question Bank.');
      }
    }

    console.log('Database already seeded. Skipping initial seeding.');
    return;
  }

  console.log('Seeding Eduqe platform with demonstration data...');

  // 1. Create Administrator
  const adminId = 'usr_admin_001';
  db.run(
    `INSERT INTO users (id, username, email, password_hash, role, first_name, surname, account_status, must_change_password, created_at)
     VALUES (?, 'admin', 'admin@eduqe.example.com', ?, 'administrator', 'System', 'Administrator', 'active', 0, datetime('now'))`,
    [adminId, hashPassword('Admin2026!')]
  );

  // 2. Create Course: AZ-104 Exam Preparation
  const course = createCourse({
    name: 'AZ-104 Exam Preparation',
    code: 'AZ104',
    description: 'Comprehensive preparation programme covering Azure administration, identity, storage, compute, and virtual networking concepts.',
    subject: 'Cloud Computing & Infrastructure',
    learning_track: 'Azure Systems Administration',
    status: 'published',
    access_code: 'AZ104-CENTURION-01',
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2027-12-31T23:59:59Z',
    adminUserId: adminId,
    adminUsername: 'admin'
  });

  // 3. Create Demonstration Instructor
  const instructorId = 'usr_inst_001';
  db.run(
    `INSERT INTO users (id, username, email, password_hash, role, first_name, surname, account_status, must_change_password, created_at)
     VALUES (?, 'evelyn.reed', 'evelyn.reed@eduqe.example.com', ?, 'instructor', 'Dr. Evelyn', 'Reed', 'active', 0, datetime('now'))`,
    [instructorId, hashPassword('Eduqe2026!')]
  );

  // 4. Create Two Classes under AZ-104
  const classA = createClass({
    courseId: course.id,
    name: 'November Morning Class',
    description: 'Instructor-led morning cohort with daily assessment sessions.',
    facilitator_name: 'Dr. Evelyn Reed',
    instructor_id: instructorId,
    start_date: '2026-11-01T08:00:00Z',
    end_date: '2026-11-30T17:00:00Z',
    access_duration_days: 30,
    access_code: 'AZ104-CENTURION-01',
    status: 'active',
    adminUserId: adminId
  });

  const classB = createClass({
    courseId: course.id,
    name: 'Weekend Class',
    description: 'Intensive weekend study group with hands-on practice exams.',
    facilitator_name: 'Marcus Vance',
    start_date: '2026-11-01T09:00:00Z',
    end_date: '2026-12-15T18:00:00Z',
    access_duration_days: 45,
    access_code: 'AZ104-WEEKEND-01',
    status: 'active',
    adminUserId: adminId
  });

  // 5. Create Demonstration Students
  const student1 = createStudent({
    first_name: 'Alex',
    surname: 'Morgan',
    username: 'alex.morgan',
    email: 'alex.morgan@student.eduqe.example.com',
    student_number: 'STU-10021',
    temporary_password: 'Eduqe2026!',
    account_status: 'active',
    must_change_password: true, // Requires password change at first sign-in!
    class_ids: [classA.id],
    adminUserId: adminId
  });

  const student2 = createStudent({
    first_name: 'Sarah',
    surname: 'Chen',
    username: 'sarah.chen',
    email: 'sarah.chen@student.eduqe.example.com',
    student_number: 'STU-10022',
    temporary_password: 'Eduqe2026!',
    account_status: 'active',
    must_change_password: false,
    class_ids: [classA.id, classB.id], // Belongs to multiple classes!
    adminUserId: adminId
  });

  const student3 = createStudent({
    first_name: 'Jordan',
    surname: 'Taylor',
    username: 'jordan.taylor',
    email: 'jordan.taylor@student.eduqe.example.com',
    student_number: 'STU-10023',
    temporary_password: 'Eduqe2026!',
    account_status: 'active',
    must_change_password: false,
    class_ids: [classB.id],
    adminUserId: adminId
  });

  // 5. Create Demonstration Questions in the Question Bank
  // Q1: Yes/No
  const q1 = createQuestion({
    course_id: course.id,
    topic: 'Resource Management',
    learning_objective: 'Manage Azure Resource Groups',
    difficulty: 'easy',
    tags: ['Azure', 'ResourceGroup', 'Governance'],
    question_type: 'yes_no',
    question_text: 'Can an Azure resource group contain resources that are deployed to different geographical regions?',
    question_description: 'An organisation deploys resources across North Europe, West Europe, and East US. An administrator needs to organize these workloads into logical units for lifecycle and billing management.',
    answer_options: ['Yes', 'No'],
    correct_answer: 'Yes',
    answer_explanation: 'Yes. An Azure resource group is a logical container for resources. Resources inside the same resource group can reside in different supported Azure regions.',
    points: 1,
    status: 'published',
    adminUserId: adminId
  });

  // Q2: True/False
  const q2 = createQuestion({
    course_id: course.id,
    topic: 'Storage Management',
    learning_objective: 'Configure Azure Blob Storage Access Tiers',
    difficulty: 'easy',
    tags: ['Storage', 'Blob', 'Cost'],
    question_type: 'true_false',
    question_text: 'The Azure Blob Storage Cool access tier has higher storage costs and lower access fees compared to the Hot access tier.',
    question_description: 'A finance department is evaluating storage tiers for archival data stored in an Azure general-purpose v2 storage account.',
    answer_options: ['True', 'False'],
    correct_answer: 'False',
    answer_explanation: 'False. The Cool tier has lower storage costs per gigabyte, but higher access (read/write transaction) fees compared to the Hot tier.',
    points: 1,
    status: 'published',
    adminUserId: adminId
  });

  // Q3: Single Choice
  const q3 = createQuestion({
    course_id: course.id,
    topic: 'Governance & Compliance',
    learning_objective: 'Apply Resource Locks',
    difficulty: 'medium',
    tags: ['Governance', 'ResourceLocks', 'Security'],
    question_type: 'single_choice',
    question_text: 'Which feature should an administrator configure to prevent administrators and users from accidentally deleting a mission-critical Azure virtual machine?',
    question_description: 'Several engineers have Contributor permissions across the production subscription. Management requires a technical control to prevent VM deletion without revoking Contributor rights.',
    answer_options: [
      { id: 'opt_lock', text: 'CanNotDelete Resource Lock on the virtual machine' },
      { id: 'opt_tag', text: 'Apply a "DoNotDelete" resource tag' },
      { id: 'opt_nsg', text: 'Network Security Group rule denying outbound port 443' },
      { id: 'opt_policy', text: 'Azure Advisor recommendation alert' }
    ],
    correct_answer: 'opt_lock',
    answer_explanation: 'A CanNotDelete resource lock prevents authorized users from deleting a resource, while still allowing them to read and modify it.',
    points: 1,
    status: 'published',
    adminUserId: adminId
  });

  // Q4: Multiple Response (Select TWO answers)
  const q4 = createQuestion({
    course_id: course.id,
    topic: 'Identity & Access',
    learning_objective: 'Configure Azure Role-Based Access Control (RBAC)',
    difficulty: 'medium',
    tags: ['RBAC', 'Entra', 'Security'],
    question_type: 'multiple_response',
    question_text: 'Which TWO built-in Azure RBAC roles grant permissions to create, start, and restart virtual machines? Select TWO answers.',
    question_description: 'An operations team needs permission to manage the lifecycle of virtual machines in the Prod-RG resource group without granting full subscription management.',
    answer_options: [
      { id: 'opt_vm_contrib', text: 'Virtual Machine Contributor' },
      { id: 'opt_owner', text: 'Owner' },
      { id: 'opt_reader', text: 'Reader' },
      { id: 'opt_storage', text: 'Storage Blob Data Reader' }
    ],
    correct_answer: ['opt_vm_contrib', 'opt_owner'],
    answer_explanation: 'Both "Virtual Machine Contributor" and "Owner" have full permissions to manage VM lifecycles (create, restart, deallocate). Reader only grants read access, and Storage Blob Data Reader is for blob data.',
    points: 2,
    partial_credit: true,
    status: 'published',
    adminUserId: adminId
  });

  // Q5: Drag and Drop: Microsoft DRAG DROP Matching (Azure Storage Services)
  const q5 = createQuestion({
    course_id: course.id,
    topic: 'Storage Accounts',
    learning_objective: 'Configure Azure Storage Services and Access Tiers',
    difficulty: 'medium',
    tags: ['Matching', 'Drag-and-Drop', 'Storage', 'Azure Blob', 'Azure Files'],
    question_type: 'matching',
    question_text: 'Match the Azure storage services to the appropriate descriptions.',
    question_description: 'To answer, drag the appropriate storage service from the column on the left to its description on the right. Each service may be used once, more than once, or not at all.\n\nNOTE: Each correct match is worth one point.',
    answer_options: {
      source_title: 'Storage service',
      target_title: 'Answer Area',
      sources: [
        { id: 'src_blob', text: 'Azure Blob storage' },
        { id: 'src_disk', text: 'Azure Disk storage' },
        { id: 'src_files', text: 'Azure Files' },
        { id: 'src_queue', text: 'Azure Queue Storage' }
      ],
      targets: [
        { id: 'tgt_msg', text: 'Used for reliable messaging between applications' },
        { id: 'tgt_share', text: 'Can be accessed as a network share from a Windows device' },
        { id: 'tgt_archive', text: 'Can be configured to use the Archive access tier' }
      ]
    },
    correct_answer: {
      tgt_msg: 'src_queue',
      tgt_share: 'src_files',
      tgt_archive: 'src_blob'
    },
    answer_explanation: 'Azure Queue Storage is designed for asynchronous, reliable message queues between application components. Azure Files provides serverless SMB/NFS file shares mounted directly on Windows, macOS, or Linux. Azure Blob storage supports the Archive access tier for low-cost offline data storage. Azure Disk storage is persistent block storage attached to virtual machines.',
    points: 3,
    partial_credit: true,
    status: 'published',
    adminUserId: adminId
  });

  // Q6: Drag and Drop: Ordering
  const q6 = createQuestion({
    course_id: course.id,
    topic: 'Virtual Networking',
    learning_objective: 'Configure Virtual Network Peering',
    difficulty: 'hard',
    tags: ['Networking', 'VNet', 'Peering', 'Ordering'],
    question_type: 'ordering',
    question_text: 'Arrange the following steps in the correct chronological order to establish a bidirectional VNet Peering between VNet1 (Subscription A) and VNet2 (Subscription B).',
    question_description: 'You need to enable low-latency communication between two virtual networks deployed across separate Azure subscriptions.',
    answer_options: [
      { id: 'step_1', text: 'Verify non-overlapping address spaces across both VNets' },
      { id: 'step_2', text: 'Initiate peering link from VNet1 to VNet2 in Subscription A' },
      { id: 'step_3', text: 'Create reciprocal peering link from VNet2 to VNet1 in Subscription B' },
      { id: 'step_4', text: 'Confirm the Peering Status transitions to Connected on both links' }
    ],
    correct_answer: ['step_1', 'step_2', 'step_3', 'step_4'],
    answer_explanation: 'Before peering, IP address spaces must be non-overlapping. Next, configure peering on both sides (VNet1 -> VNet2 and VNet2 -> VNet1). Once both links are established, the state transitions from "Initiated" to "Connected".',
    points: 2,
    partial_credit: true,
    status: 'published',
    adminUserId: adminId
  });

  // Q7: Scenario Question with rich Question Description
  const q7 = createQuestion({
    course_id: course.id,
    topic: 'Virtual Networking & Security',
    learning_objective: 'Design Hub-and-Spoke Network Security',
    difficulty: 'hard',
    tags: ['Scenario', 'CaseStudy', 'Firewall', 'NSG'],
    question_type: 'scenario',
    question_text: 'Which routing and filtering configuration should the administrator implement to force all spoke-to-spoke traffic through the Azure Firewall?',
    question_description: `### Enterprise Network Architecture Scenario

**Current Infrastructure:**
- Hub VNet: \`10.0.0.0/16\` (Hosting Azure Firewall on subnet \`10.0.1.0/24\`, private IP \`10.0.1.4\`)
- Spoke 1 VNet: \`10.1.0.0/16\` (Web tier subnet \`10.1.1.0/24\`)
- Spoke 2 VNet: \`10.2.0.0/16\` (App tier subnet \`10.2.1.0/24\`)
- VNet Peering is established between Hub and each Spoke. Direct peering between Spoke 1 and Spoke 2 is prohibited by compliance policy.

**Requirements:**
1. All network traffic between Spoke 1 and Spoke 2 must be inspected by Azure Firewall.
2. Spoke subnets must not route traffic directly to other spokes.
3. System routes must be overridden with minimal administrative overhead.`,
    answer_options: [
      { id: 'opt_udr', text: 'Create a User-Defined Route (UDR) on spoke subnets with 0.0.0.0/0 next-hop Virtual Appliance pointing to 10.0.1.4' },
      { id: 'opt_nsg_only', text: 'Deploy an NSG with an inbound deny rule on Spoke 2 subnet' },
      { id: 'opt_gateway', text: 'Deploy an ExpressRoute gateway in Spoke 1' },
      { id: 'opt_dns', text: 'Configure Azure Private DNS zone with wildcards' }
    ],
    correct_answer: 'opt_udr',
    answer_explanation: 'A User-Defined Route (UDR) associated with the spoke subnets directing target traffic (or default 0.0.0.0/0) to the Virtual Appliance IP (10.0.1.4) forces all spoke-to-spoke communications through the firewall for inspection.',
    points: 2,
    status: 'published',
    adminUserId: adminId
  });

  // Q8: Categorisation
  const q8 = createQuestion({
    course_id: course.id,
    topic: 'Cloud Fundamentals',
    learning_objective: 'Differentiate Cloud Service Models',
    difficulty: 'medium',
    tags: ['CloudModels', 'IaaS', 'PaaS', 'SaaS'],
    question_type: 'categorisation',
    question_text: 'Categorise each listed Azure or cloud service into its corresponding cloud service model (IaaS, PaaS, or SaaS).',
    question_description: 'An architectural review requires classifying services to establish shared responsibility model boundaries.',
    answer_options: [
      { text: 'Azure Virtual Machines', category: 'IaaS' },
      { text: 'Azure App Service', category: 'PaaS' },
      { text: 'Microsoft 365', category: 'SaaS' },
      { text: 'Azure SQL Database', category: 'PaaS' },
      { text: 'Azure Virtual Network', category: 'IaaS' }
    ],
    correct_answer: {
      IaaS: ['Azure Virtual Machines', 'Azure Virtual Network'],
      PaaS: ['Azure App Service', 'Azure SQL Database'],
      SaaS: ['Microsoft 365']
    },
    answer_explanation: 'VMs and VNets are Infrastructure as a Service (IaaS). App Service and Azure SQL Database provide managed runtimes (PaaS). Microsoft 365 is a fully managed cloud productivity application (SaaS).',
    points: 2,
    partial_credit: true,
    status: 'published',
    adminUserId: adminId
  });

  // Q9: Fill in the Blank
  const q9 = createQuestion({
    course_id: course.id,
    topic: 'Azure CLI',
    learning_objective: 'Manage Resources via CLI',
    difficulty: 'medium',
    tags: ['CLI', 'Automation'],
    question_type: 'fill_blank',
    question_text: 'Enter the exact Azure CLI command syntax used to create a new resource group named "rg-prod" in the "eastus" region.',
    question_description: 'An administrator needs to script resource group creation in a CI/CD pipeline using the Azure cross-platform CLI.',
    answer_options: {
      case_sensitive: false,
      ignore_spaces: true,
      ignore_punctuation: false
    },
    correct_answer: 'az group create --name rg-prod --location eastus|az group create -n rg-prod -l eastus|az group create --location eastus --name rg-prod|az group create -l eastus -n rg-prod',
    answer_explanation: 'The Azure CLI command "az group create" takes parameters "--name" (-n) and "--location" (-l). Both short and long flag options are accepted.',
    points: 1,
    status: 'published',
    adminUserId: adminId
  });

  // Q10: Dropdown Selection
  const q10 = createQuestion({
    course_id: course.id,
    topic: 'Storage Management',
    learning_objective: 'Configure Storage Replication',
    difficulty: 'medium',
    tags: ['Storage', 'Redundancy', 'Dropdown'],
    question_type: 'dropdown',
    question_text: 'Select the appropriate storage redundancy option for each disaster recovery requirement.',
    question_description: 'Complete the sentences by selecting the correct storage replication tier from the dropdown options.',
    answer_options: [
      {
        id: 'blank_dc',
        placeholder: 'Select redundancy for datacenter failure',
        options: ['LRS (Locally Redundant Storage)', 'ZRS (Zone-Redundant Storage)', 'GRS (Geo-Redundant Storage)']
      },
      {
        id: 'blank_region',
        placeholder: 'Select redundancy for regional disaster',
        options: ['LRS (Locally Redundant Storage)', 'ZRS (Zone-Redundant Storage)', 'GRS (Geo-Redundant Storage)']
      }
    ],
    correct_answer: {
      blank_dc: 'ZRS (Zone-Redundant Storage)',
      blank_region: 'GRS (Geo-Redundant Storage)'
    },
    answer_explanation: 'ZRS replicates data synchronously across three Azure availability zones within the primary region, protecting against datacenter failure. GRS replicates asynchronously to a paired secondary region, protecting against regional disasters.',
    points: 2,
    partial_credit: true,
    status: 'published',
    adminUserId: adminId
  });

  // Q11: Hot Area / Visual Selection
  const q11 = createQuestion({
    course_id: course.id,
    topic: 'Virtual Networking',
    learning_objective: 'Design VPN Gateway Subnet',
    difficulty: 'medium',
    tags: ['HotArea', 'GatewaySubnet', 'Visual'],
    question_type: 'hot_area',
    question_text: 'Select the designated subnet area on the virtual network diagram that must be reserved exclusively for the Azure Virtual Network Gateway.',
    question_description: `Diagram of Virtual Network (VNet-Production 10.0.0.0/16):
- Subnet 1: GatewaySubnet (10.0.0.0/24) [Dedicated for VPN / ExpressRoute gateway]
- Subnet 2: AzureFirewallSubnet (10.0.1.0/24)
- Subnet 3: WorkloadSubnet (10.0.2.0/24)

Click on the designated Gateway Subnet component below.`,
    answer_options: [
      { id: 'area_gateway', label: 'GatewaySubnet (10.0.0.0/24)' },
      { id: 'area_firewall', label: 'AzureFirewallSubnet (10.0.1.0/24)' },
      { id: 'area_workload', label: 'WorkloadSubnet (10.0.2.0/24)' }
    ],
    correct_answer: 'area_gateway',
    answer_explanation: 'Azure requires the virtual network gateway to be deployed into a dedicated subnet named exactly "GatewaySubnet". No other resources can be placed in this subnet.',
    points: 1,
    status: 'published',
    adminUserId: adminId
  });

  // Q12: Hotspot (Statement Table / Yes-No Matrix)
  const q12 = createQuestion({
    course_id: course.id,
    topic: 'Cloud Models & Architecture',
    learning_objective: 'Understand Cloud Computing Models',
    difficulty: 'medium',
    tags: ['Hotspot', 'CloudModels', 'HybridCloud', 'PublicCloud'],
    question_type: 'hotspot',
    question_text: 'For each of the following statements, select Yes if the statement is true. Otherwise, select No.',
    question_description: 'NOTE: Each correct selection is worth one point.\nHot Area:\nAnswer Area',
    answer_options: [
      { id: 'stmt_1', statement: 'To achieve a hybrid cloud model, a company must always migrate from a private cloud model.', options: ['Yes', 'No'] },
      { id: 'stmt_2', statement: 'A company can extend the capacity of its internal network by using the public cloud.', options: ['Yes', 'No'] },
      { id: 'stmt_3', statement: 'In a public cloud model, only guest users at your company can access the resources in the cloud.', options: ['Yes', 'No'] }
    ],
    correct_answer: {
      stmt_1: 'No',
      stmt_2: 'Yes',
      stmt_3: 'No'
    },
    answer_explanation: 'Statement 1: A company can adopt a hybrid cloud model directly without migrating from an existing private cloud. Statement 2: Public cloud can extend on-premises network and compute capacity. Statement 3: In a public cloud model, authorized corporate users, administrators, and services can access resources, not just guest users.',
    points: 3,
    partial_credit: true,
    status: 'published',
    adminUserId: adminId
  });

  // 6. Create Question Pool
  const pool = createPool({
    courseId: course.id,
    name: 'Azure Identity & Governance Pool',
    description: 'Question pool covering RBAC, Entra ID, Resource Locks, and Policy compliance.',
    randomCount: 3,
    adminUserId: adminId
  });

  addQuestionToPool(pool.id, q1.id);
  addQuestionToPool(pool.id, q2.id);
  addQuestionToPool(pool.id, q3.id);
  addQuestionToPool(pool.id, q4.id);
  addQuestionToPool(pool.id, q5.id);

  // 7. Create Demonstration Assessment (with 3 default sections)
  const assessment = createAssessment({
    course_id: course.id,
    name: 'AZ-104 Practice Certification Assessment',
    description: 'Comprehensive exam simulation with varied interactive questions and scenario case studies.',
    instructions: 'Welcome to the AZ-104 Exam Preparation Assessment. Please read all questions carefully. You have 45 minutes to complete this assessment. Complete each Section in order and then move over to the next section. When finished, submit your answers to view your score and explanations.',
    pass_mark_percentage: 70,
    duration_minutes: 45,
    max_attempts: 0,
    allow_back_navigation: true,
    allow_flagging: true,
    allow_review_screen: true,
    randomize_questions: false,
    randomize_answers: false,
    result_visibility: 'immediate',
    explanation_visibility: 'after_submission',
    sections: ['Section 1', 'Section 2', 'Section 3'],
    status: 'published',
    class_ids: [classA.id, classB.id],
    adminUserId: adminId
  });

  // Add questions across the 3 default sections
  addQuestionToAssessment(assessment.id, q1.id, { sectionName: 'Section 1' });
  addQuestionToAssessment(assessment.id, q2.id, { sectionName: 'Section 1' });
  addQuestionToAssessment(assessment.id, q8.id, { sectionName: 'Section 1' });
  addQuestionToAssessment(assessment.id, q10.id, { sectionName: 'Section 1' });
  addQuestionToAssessment(assessment.id, q12.id, { sectionName: 'Section 1' });

  addQuestionToAssessment(assessment.id, q3.id, { sectionName: 'Section 2' });
  addQuestionToAssessment(assessment.id, q4.id, { sectionName: 'Section 2' });
  addQuestionToAssessment(assessment.id, q5.id, { sectionName: 'Section 2' });
  addQuestionToAssessment(assessment.id, q9.id, { sectionName: 'Section 2' });

  addQuestionToAssessment(assessment.id, q6.id, { sectionName: 'Section 3' });
  addQuestionToAssessment(assessment.id, q7.id, { sectionName: 'Section 3' });
  addQuestionToAssessment(assessment.id, q11.id, { sectionName: 'Section 3' });

  console.log('Seeding completed successfully!');
  console.log(`- Course: ${course.name} (Code: ${course.code}, Access Code: AZ104-CENTURION-01)`);
  console.log(`- Classes: ${classA.name}, ${classB.name}`);
  console.log(`- Admin: admin / Admin2026!`);
  console.log(`- Instructor: evelyn.reed / Eduqe2026! (Dr. Evelyn Reed)`);
  console.log(`- Students: alex.morgan / Eduqe2026! (requires password change), sarah.chen / Eduqe2026!`);
  console.log(`- Assessment: ${assessment.name} with 11 diverse questions`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
